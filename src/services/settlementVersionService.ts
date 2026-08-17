import {
  Bytes,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import type { MonthId } from '../types/firestore';
import type { EmployeeMonthlyCalculationDraft } from '../utils/payroll';
import {
  renderAbsenceWorkbook,
  type SettlementExportPackage,
} from '../utils/reports';
import { firestorePaths } from './firestore/paths';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';
import { buildSettlementReadiness } from './settlementReadiness';

const ARTIFACT_CHUNK_SIZE = 500_000;
const MAX_ATOMIC_WRITES = 480;

export interface SettlementVersionArtifact {
  id: string;
  fileName: string;
  mimeType: string;
  content: Uint8Array;
}

export interface SettlementVersionMetadata {
  id: string;
  versionNumber: number;
  calculationVersion: number;
  inputHash: string;
  createdAt: Date;
  createdBy: string;
  employeeCount: number;
  blockerCount: number;
  warningCount: number;
  artifactCount: number;
}

export interface ClosedSettlementVersion extends SettlementVersionMetadata {
  drafts: EmployeeMonthlyCalculationDraft[];
  artifacts: SettlementVersionArtifact[];
}

export async function closeSettlementMonth({
  monthId,
  drafts,
  inputHash,
  exportPackage,
}: {
  monthId: MonthId;
  drafts: readonly EmployeeMonthlyCalculationDraft[];
  inputHash: string;
  exportPackage: SettlementExportPackage;
}) {
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  const actorUid = auth?.currentUser?.uid;
  if (!firestore || !repositories || !actorUid) {
    throw new Error('calculation-unavailable');
  }
  const readiness = buildSettlementReadiness({
    drafts,
    exportWarnings: exportPackage.warnings,
  });
  if (!readiness.canClose) throw new Error('month-not-ready');

  const artifacts = await buildFinalSettlementArtifacts(exportPackage);
  const chunkedArtifacts = artifacts.map((artifact) => ({
    ...artifact,
    chunks: splitBytes(artifact.content),
  }));
  const writeCount =
    3 +
    drafts.length +
    chunkedArtifacts.length +
    chunkedArtifacts.reduce(
      (total, artifact) => total + artifact.chunks.length,
      0,
    );
  if (writeCount > MAX_ATOMIC_WRITES) {
    throw new Error('settlement-snapshot-write-limit');
  }

  const monthRef = repositories.forMonth(monthId).month;
  return runTransaction(firestore, async (transaction) => {
    const monthSnapshot = await transaction.get(monthRef);
    if (!monthSnapshot.exists()) throw new Error('month-unavailable');
    const month = monthSnapshot.data();
    if (month.is_settled) throw new Error('month-locked');
    if (
      month.calculation_status !== 'completed' ||
      month.calculation_input_hash !== inputHash ||
      (month.calculation_blocker_count ?? 0) > 0
    ) {
      throw new Error('month-not-ready');
    }

    const versionNumber = (month.settlement_version_number ?? 0) + 1;
    const versionId = `v${versionNumber.toString().padStart(4, '0')}`;
    const versionPath = firestorePaths.settlementVersion(monthId, versionId);
    transaction.set(doc(firestore, versionPath), {
      month_id: monthId,
      version_number: versionNumber,
      calculation_version: month.calculation_version,
      calculation_input_hash: inputHash,
      created_at: serverTimestamp(),
      created_by: actorUid,
      employee_count: drafts.length,
      blocker_count: readiness.blockers.length,
      warning_count: readiness.warnings.length,
      warning_codes: readiness.warnings.map((warning) => warning.code),
      artifact_count: artifacts.length,
    });

    drafts.forEach((draft) => {
      transaction.set(
        doc(
          firestore,
          firestorePaths.settlementVersionCalculations(monthId, versionId),
          draft.employeeId,
        ),
        {
          employee_id: draft.employeeId,
          teta_number: draft.tetaNumber,
          result: serializeDraft(draft),
        },
      );
    });
    chunkedArtifacts.forEach((artifact) => {
      const artifactRef = doc(
        firestore,
        firestorePaths.settlementVersionArtifacts(monthId, versionId),
        artifact.id,
      );
      transaction.set(artifactRef, {
        artifact_id: artifact.id,
        file_name: artifact.fileName,
        mime_type: artifact.mimeType,
        byte_size: artifact.content.byteLength,
        chunk_count: artifact.chunks.length,
      });
      artifact.chunks.forEach((chunk, index) => {
        transaction.set(
          doc(
            firestore,
            firestorePaths.settlementVersionArtifactChunks(
              monthId,
              versionId,
              artifact.id,
            ),
            index.toString().padStart(4, '0'),
          ),
          { chunk_index: index, content: Bytes.fromUint8Array(chunk) },
        );
      });
    });

    transaction.update(monthRef, {
      is_settled: true,
      settled_at: serverTimestamp(),
      settled_by: actorUid,
      settlement_version_number: versionNumber,
      current_settlement_version_id: versionId,
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    });
    transaction.set(doc(repositories.auditLog), {
      entity_path: firestorePaths.month(monthId),
      action: 'settle',
      actor_uid: actorUid,
      occurred_at: serverTimestamp(),
      changes: {
        operation: 'month-closed',
        month_id: monthId,
        settlement_version_id: versionId,
        settlement_version_number: versionNumber,
        calculation_version: month.calculation_version,
        calculation_input_hash: inputHash,
        employee_count: drafts.length,
        warning_count: readiness.warnings.length,
        artifact_count: artifacts.length,
      },
    });
    return versionId;
  });
}

export async function reopenSettlementMonth(monthId: MonthId, reason: string) {
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error('reopen-reason-required');
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  const actorUid = auth?.currentUser?.uid;
  if (!firestore || !repositories || !actorUid) {
    throw new Error('calculation-unavailable');
  }
  const monthRef = repositories.forMonth(monthId).month;
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(monthRef);
    if (!snapshot.exists()) throw new Error('month-unavailable');
    const month = snapshot.data();
    if (!month.is_settled) throw new Error('month-already-open');
    transaction.update(monthRef, {
      is_settled: false,
      settled_at: null,
      settled_by: null,
      calculation_status: 'queued',
      calculation_input_hash: null,
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    });
    transaction.set(doc(repositories.auditLog), {
      entity_path: firestorePaths.month(monthId),
      action: 'update',
      actor_uid: actorUid,
      occurred_at: serverTimestamp(),
      changes: {
        operation: 'month-reopened',
        month_id: monthId,
        settlement_version_id: month.current_settlement_version_id ?? null,
        settlement_version_number: month.settlement_version_number ?? 0,
        reason: normalizedReason,
      },
    });
  });
}

export async function loadClosedSettlementVersion(
  monthId: MonthId,
  versionId: string,
): Promise<ClosedSettlementVersion> {
  const firestore = getFirestoreClient();
  if (!firestore) throw new Error('calculation-unavailable');
  const versionRef = doc(
    firestore,
    firestorePaths.settlementVersion(monthId, versionId),
  );
  const [versionSnapshot, calculationSnapshot, artifactSnapshot] =
    await Promise.all([
      getDoc(versionRef),
      getDocs(
        collection(
          firestore,
          firestorePaths.settlementVersionCalculations(monthId, versionId),
        ),
      ),
      getDocs(
        collection(
          firestore,
          firestorePaths.settlementVersionArtifacts(monthId, versionId),
        ),
      ),
    ]);
  if (!versionSnapshot.exists())
    throw new Error('settlement-version-unavailable');
  const data = versionSnapshot.data();
  const artifacts = await Promise.all(
    artifactSnapshot.docs.map(async (artifactDocument) => {
      const artifact = artifactDocument.data();
      const chunks = await getDocs(
        collection(
          firestore,
          firestorePaths.settlementVersionArtifactChunks(
            monthId,
            versionId,
            artifactDocument.id,
          ),
        ),
      );
      const ordered = chunks.docs
        .map((chunkDocument) => chunkDocument.data())
        .sort((first, second) => first.chunk_index - second.chunk_index)
        .map((chunk) => (chunk.content as Bytes).toUint8Array());
      return {
        id: artifactDocument.id,
        fileName: artifact.file_name as string,
        mimeType: artifact.mime_type as string,
        content: concatenateBytes(ordered),
      };
    }),
  );
  return {
    id: versionSnapshot.id,
    versionNumber: data.version_number as number,
    calculationVersion: data.calculation_version as number,
    inputHash: data.calculation_input_hash as string,
    createdAt: data.created_at.toDate(),
    createdBy: data.created_by as string,
    employeeCount: data.employee_count as number,
    blockerCount: data.blocker_count as number,
    warningCount: data.warning_count as number,
    artifactCount: data.artifact_count as number,
    drafts: calculationSnapshot.docs.map(
      (document) => document.data().result as EmployeeMonthlyCalculationDraft,
    ),
    artifacts,
  };
}

export async function listSettlementVersions(
  monthId: MonthId,
): Promise<SettlementVersionMetadata[]> {
  const firestore = getFirestoreClient();
  if (!firestore) return [];
  const snapshot = await getDocs(
    collection(firestore, firestorePaths.settlementVersions(monthId)),
  );
  return snapshot.docs
    .map((document) => {
      const data = document.data();
      return {
        id: document.id,
        versionNumber: data.version_number as number,
        calculationVersion: data.calculation_version as number,
        inputHash: data.calculation_input_hash as string,
        createdAt: data.created_at.toDate(),
        createdBy: data.created_by as string,
        employeeCount: data.employee_count as number,
        blockerCount: data.blocker_count as number,
        warningCount: data.warning_count as number,
        artifactCount: data.artifact_count as number,
      };
    })
    .sort((first, second) => second.versionNumber - first.versionNumber);
}

export async function buildFinalSettlementArtifacts(
  exportPackage: SettlementExportPackage,
): Promise<SettlementVersionArtifact[]> {
  const encoder = new TextEncoder();
  const [absencePl, absenceForeign] = await Promise.all([
    renderAbsenceWorkbook(
      exportPackage.absences.polishRows,
      exportPackage.monthId,
    ),
    renderAbsenceWorkbook(
      exportPackage.absences.foreignRows,
      exportPackage.monthId,
    ),
  ]);
  const artifacts: SettlementVersionArtifact[] = [
    binaryArtifact(
      'toyota-xlsx',
      exportPackage.toyota.fileName,
      exportPackage.toyota.workbook,
    ),
    textArtifact(
      'soz-pl-csv',
      exportPackage.soz.plFileName,
      exportPackage.soz.polishCsv,
      'text/csv;charset=utf-8',
      encoder,
    ),
    textArtifact(
      'soz-foreign-csv',
      exportPackage.soz.foreignFileName,
      exportPackage.soz.foreignCsv,
      'text/csv;charset=utf-8',
      encoder,
    ),
    binaryArtifact(
      'absence-pl-xlsx',
      exportPackage.absences.plFileName,
      absencePl,
    ),
    binaryArtifact(
      'absence-foreign-xlsx',
      exportPackage.absences.foreignFileName,
      absenceForeign,
    ),
    textArtifact(
      'soz-note',
      exportPackage.soz.noteFileName,
      exportPackage.soz.note,
      'text/plain;charset=utf-8',
      encoder,
    ),
  ];
  if (
    exportPackage.soz.polishCompensationWorkbook &&
    exportPackage.soz.polishCompensationFileName
  ) {
    artifacts.push(
      binaryArtifact(
        'compensation-pl-xlsx',
        exportPackage.soz.polishCompensationFileName,
        exportPackage.soz.polishCompensationWorkbook,
      ),
    );
  }
  if (
    exportPackage.soz.foreignCompensationWorkbook &&
    exportPackage.soz.foreignCompensationFileName
  ) {
    artifacts.push(
      binaryArtifact(
        'compensation-foreign-xlsx',
        exportPackage.soz.foreignCompensationFileName,
        exportPackage.soz.foreignCompensationWorkbook,
      ),
    );
  }
  return artifacts;
}

function binaryArtifact(id: string, fileName: string, content: Uint8Array) {
  return {
    id,
    fileName,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: new Uint8Array(content),
  };
}

function textArtifact(
  id: string,
  fileName: string,
  content: string,
  mimeType: string,
  encoder: TextEncoder,
) {
  return { id, fileName, mimeType, content: encoder.encode(content) };
}

function splitBytes(content: Uint8Array) {
  const chunks: Uint8Array[] = [];
  for (
    let offset = 0;
    offset < content.byteLength;
    offset += ARTIFACT_CHUNK_SIZE
  ) {
    chunks.push(content.slice(offset, offset + ARTIFACT_CHUNK_SIZE));
  }
  return chunks.length ? chunks : [new Uint8Array()];
}

function concatenateBytes(chunks: readonly Uint8Array[]) {
  const output = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
  );
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return output;
}

function serializeDraft(draft: EmployeeMonthlyCalculationDraft) {
  return JSON.parse(JSON.stringify(draft)) as Record<string, unknown>;
}
