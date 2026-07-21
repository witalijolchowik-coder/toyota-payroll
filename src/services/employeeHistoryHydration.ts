import type {
  Employee,
  EmployeeContract,
  EmploymentEndEvent,
} from '../types/firestore';

export function hydrateEmployeesWithEmploymentHistory(
  employees: readonly Employee[],
  contracts: readonly EmployeeContract[],
  employmentEndEvents: readonly EmploymentEndEvent[],
): Employee[] {
  const contractsByEmployee = new Map<string, EmployeeContract[]>();
  const endEventsByEmployee = new Map<string, EmploymentEndEvent[]>();

  contracts.forEach((contract) => {
    const employeeContracts =
      contractsByEmployee.get(contract.employeeId) ?? [];
    employeeContracts.push(contract);
    contractsByEmployee.set(contract.employeeId, employeeContracts);
  });
  employmentEndEvents.forEach((event) => {
    const employeeEvents = endEventsByEmployee.get(event.employeeId) ?? [];
    employeeEvents.push(event);
    endEventsByEmployee.set(event.employeeId, employeeEvents);
  });

  return employees.map((employee) => ({
    ...employee,
    contracts: contractsByEmployee.get(employee.id) ?? [],
    employmentEndEvents: endEventsByEmployee.get(employee.id) ?? [],
  }));
}
