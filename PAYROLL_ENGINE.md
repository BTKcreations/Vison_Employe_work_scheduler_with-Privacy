# Vision SaaS: Payroll Engine & Salary Calculation Guide

Vision implements an automated, high-precision payroll engine that integrates real-time attendance, leave balances, and performance metrics to generate monthly salary drafts.

## 1. 🏗️ Salary Structure Components
Every employee is assigned a **Salary Structure** with the following fixed components:
*   **Earnings**: Basic, HRA (House Rent Allowance), and Special Allowance.
*   **Deductions**: PF (Provident Fund), ESI (Employee State Insurance), and Income Tax.

---

## 2. 🧮 Core Calculation Logic

### **Step 1: Month Window & Proration**
The engine determines the total working days in a month based on the company's work schedule (e.g., Mon-Fri) and official holidays.
*   **Mid-Month Joiners**: If an employee joins mid-month, their earnings and fixed deductions (PF, Tax) are **prorated** based on the active days remaining in that month.
*   **Formula**: `Prorated Component = Component * (Active Days / Total Days in Month)`.

### **Step 2: Attendance & Leave Analysis**
The system loops through every working day of the month to categorize them:
*   **Present**: Checked-in via Geofence or approved Regularization.
*   **Paid Leave**: Approved Sick, Earned, or Casual leave (within monthly limits).
*   **Loss of Pay (LOP)**:
    *   Unexcused absences.
    *   Casual leaves exceeding the monthly limit (e.g., if the limit is 1 day and the employee takes 2).
    *   Explicit "Loss of Pay" leave type.

### **Step 3: Earnings & LOP Deductions**
*   **Gross Base**: `Basic + HRA + Special Allowance`.
*   **Daily Rate**: `Prorated Gross / Total Working Days`.
*   **LOP Deduction**: `Daily Rate * Absent Days`.
*   **Earned Salary**: `Prorated Gross - LOP Deduction`.

---

## 3. 🎁 Automated Incentives & Bonuses
Vision goes beyond basic pay by automating rewards based on operational excellence.

### **A. Attendance Bonus**
Employees earn "Attendance Points" (e.g., 1.0 for Present, 0.75 for Late < 30m).
*   **Threshold**: If the employee's attendance rate (Earned Points / Total Working Days) exceeds the **Company Threshold** (e.g., 95%), they receive a bonus (e.g., 5% of Gross Base).

### **B. Performance Incentives**
Linked directly to the **Gamified Reward Points** system.
*   **Performance Score**: `(Employee Reward Points / Role Target Points) * 100%`.
*   **Tiered Payout**: The engine checks the company's **Incentive Tiers** (e.g., 90-100% performance gets 10% of the pool).
*   **Backlog Penalty**: If an employee has **more than 5 overdue tasks** (older than 4 days), their incentive is reduced by 5%.

### **C. Flat Adjustments**
*   **Late Penalty**: A flat deduction (e.g., ₹100) is applied for every "Late" check-in log.
*   **Overtime Pay**: A flat bonus (e.g., ₹500) is awarded for every "Approved Overtime" session.

---

## 4. 🔄 Payroll Lifecycle & Auditing
To ensure financial integrity, payroll follows a strict status workflow:

1.  **Draft**: Automated generation by the HR Manager.
2.  **Under Review**: Verified by HR or a Manager.
3.  **Locked/Approved**: Finalized by an Admin. At this stage, a **Payslip** is generated and a **Version Snapshot** is saved in the `PayrollHistory` collection.
4.  **Paid**: Marked once the actual financial transfer is confirmed.

### **Version History**
Any change to a payroll record (e.g., a manual adjustment by HR or a recalculation after a late leave approval) creates a history entry. Admins can audit who changed what and why, comparing snapshots of the old and new calculations.

---

## 🛠️ Summary for Management
*   **Total Earnings**: `Earned Salary + Overtime Pay + Incentives + Bonuses`.
*   **Total Deductions**: `PF + ESI + Tax + Late Penalties + Manual Deductions`.
*   **Net Payout**: `Total Earnings - Total Deductions`.
