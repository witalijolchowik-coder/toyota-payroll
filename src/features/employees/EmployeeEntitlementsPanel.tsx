import AddOutlined from '@mui/icons-material/AddOutlined';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import type {
  Employee,
  EmployeeEntitlement,
  PayrollSetting,
} from '../../types/firestore';

interface EmployeeEntitlementsPanelProps {
  employees: Employee[];
  entitlements: EmployeeEntitlement[];
  accommodationVariants: PayrollSetting[];
  isLoading: boolean;
  error: Error | null;
  onAdd: () => void;
  onEdit: (entitlement: EmployeeEntitlement) => void;
  onCancel: (entitlement: EmployeeEntitlement) => void;
}

export function EmployeeEntitlementsPanel({
  employees,
  entitlements,
  accommodationVariants,
  isLoading,
  error,
  onAdd,
  onEdit,
  onCancel,
}: EmployeeEntitlementsPanelProps) {
  const t = useTranslations();
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee]),
  );
  const variantsByKey = new Map(
    accommodationVariants
      .filter((setting) => setting.variantKey)
      .map((setting) => [
        setting.variantKey,
        setting.variantName ?? setting.variantKey,
      ]),
  );

  return (
    <Card>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <div>
            <Typography variant="h6">
              {t.employees.entitlements.title}
            </Typography>
            <Typography color="text.secondary">
              {t.employees.entitlements.description}
            </Typography>
          </div>
          <Button
            variant="outlined"
            startIcon={<AddOutlined />}
            onClick={onAdd}
          >
            {t.employees.entitlements.add}
          </Button>
        </Stack>
      </CardContent>
      {error ? (
        <Box sx={{ px: 3, pb: 2 }}>
          <Alert severity="error">{t.employees.entitlements.loadError}</Alert>
        </Box>
      ) : null}
      <TableContainer>
        <Table sx={{ minWidth: 840 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t.employees.entitlements.table.employee}</TableCell>
              <TableCell>{t.employees.entitlements.table.type}</TableCell>
              <TableCell>{t.employees.entitlements.table.variant}</TableCell>
              <TableCell>{t.employees.entitlements.table.validity}</TableCell>
              <TableCell>{t.employees.entitlements.table.status}</TableCell>
              <TableCell>{t.employees.entitlements.table.note}</TableCell>
              <TableCell align="right">
                {t.employees.entitlements.table.actions}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }, (_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 7 }, (__, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : entitlements.map((entitlement) => {
                  const employee = employeesById.get(entitlement.employeeId);
                  return (
                    <TableRow hover key={entitlement.id}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }}>
                          {entitlement.tetaNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {employee
                            ? `${employee.lastName} ${employee.firstName}`
                            : entitlement.employeeId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {t.employees.entitlements.types[entitlement.type]}
                      </TableCell>
                      <TableCell>
                        {entitlement.accommodationVariantKey
                          ? (variantsByKey.get(
                              entitlement.accommodationVariantKey,
                            ) ?? entitlement.accommodationVariantKey)
                          : t.employees.entitlements.table.noVariant}
                      </TableCell>
                      <TableCell>
                        {entitlement.validFrom} –{' '}
                        {entitlement.validTo ??
                          t.employees.entitlements.table.noEndDate}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            t.employees.entitlements.status[entitlement.status]
                          }
                          color={
                            entitlement.status === 'ACTIVE'
                              ? 'success'
                              : 'default'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          title={entitlement.note ?? ''}
                        >
                          {entitlement.note ??
                            t.employees.entitlements.table.noNote}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {entitlement.status === 'ACTIVE' ? (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{ justifyContent: 'flex-end' }}
                          >
                            <Tooltip
                              title={t.employees.entitlements.table.edit}
                            >
                              <IconButton
                                size="small"
                                onClick={() => onEdit(entitlement)}
                                aria-label={t.employees.entitlements.table.edit}
                              >
                                <EditOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip
                              title={t.employees.entitlements.table.cancel}
                            >
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => onCancel(entitlement)}
                                aria-label={
                                  t.employees.entitlements.table.cancel
                                }
                              >
                                <CancelOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </TableContainer>
      {!isLoading && entitlements.length === 0 ? (
        <Box sx={{ px: 3, py: 5, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {t.employees.entitlements.empty}
          </Typography>
        </Box>
      ) : null}
    </Card>
  );
}
