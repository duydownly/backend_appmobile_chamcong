const express = require('express');
const cors = require('cors');
const { client, connectDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors()); // Enable CORS if needed

// Import database connection
connectDB();

// Define API routes
app.get('/dayscreen', async (req, res) => {
  try {
    const { admin_id } = req.query;
    
    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id not provided' });
    }

    const query = `
      SELECT e.id, e.name, a.date AS attendance_date, a.status AS attendance_status, a.color AS attendance_color
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id
      WHERE e.admin_id = $1
      ORDER BY e.id, a.date
    `;
    
    const result = await client.query(query, [admin_id]);

    // Transform data into desired structure
    const formattedResults = [];
    let currentEmployee = null;

    result.rows.forEach(row => {
      if (!currentEmployee || currentEmployee.id !== row.id) {
        if (currentEmployee) {
          formattedResults.push({
            id: currentEmployee.id,
            name: currentEmployee.name,
            attendance: currentEmployee.attendance,
          });
        }

        currentEmployee = {
          id: row.id,
          name: row.name,
          attendance: [],
        };
      }

      // Format the date to remove the time part
      const date = new Date(row.attendance_date);
      const formattedDate = date.getFullYear() + '-' +
                            String(date.getMonth() + 1).padStart(2, '0') + '-' +
                            String(date.getDate()).padStart(2, '0');

      currentEmployee.attendance.push({
        date: formattedDate,
        status: row.attendance_status,
        color: row.attendance_color,
      });
    });

    // Push the last employee to the formattedResults array
    if (currentEmployee) {
      formattedResults.push({
        id: currentEmployee.id,
        name: currentEmployee.name,
        attendance: currentEmployee.attendance,
      });
    }

    res.json(formattedResults);
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.put('/updateAttendance', async (req, res) => {
  const { employee_id, date, status, color } = req.body;

  if (!employee_id || !date || !status || !color) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {
    // Lấy lương từ bảng salaries
    const salaryQuery = 'SELECT salary FROM salaries WHERE employee_id = $1 LIMIT 1';
    const salaryResult = await client.query(salaryQuery, [employee_id]);
    const salary = salaryResult.rows.length > 0 ? salaryResult.rows[0].salary : 0;

    // Tính toán salaryinday dựa trên status
    let salaryinday = 0;
    if (status === 'Đủ') {
      salaryinday = salary;
    } else if (status === 'Nửa') {
      salaryinday = salary / 2;
    } else if (status === 'Vắng') {
      salaryinday = 0;
    }

    // Cập nhật attendance
    const updateQuery = `
      UPDATE attendance
      SET status = $3, color = $4, salaryinday = $5
      WHERE employee_id = $1 AND date = $2
    `;
    await client.query(updateQuery, [employee_id, date, status, color, salaryinday]);
    res.status(200).json({ message: 'Attendance updated successfully' });
  } catch (err) {
    console.error('Error updating attendance', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/addAttendance', async (req, res) => {
  const { employee_id, date, status, color } = req.body;

  if (!employee_id || !date || !status || !color) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {
    // Lấy lương từ bảng salaries
    const salaryQuery = 'SELECT salary FROM salaries WHERE employee_id = $1 LIMIT 1';
    const salaryResult = await client.query(salaryQuery, [employee_id]);
    const salary = salaryResult.rows.length > 0 ? salaryResult.rows[0].salary : 0;

    // Tính toán salaryinday dựa trên status
    let salaryinday = 0;
    if (status === 'Đủ') {
      salaryinday = salary;
    } else if (status === 'Nửa') {
      salaryinday = salary / 2;
    } else if (status === 'Vắng') {
      salaryinday = 0;
    }

    // Thêm bản ghi vào attendance
    const insertQuery = `
      INSERT INTO attendance (employee_id, date, status, color, salaryinday)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await client.query(insertQuery, [employee_id, date, status, color, salaryinday]);
    res.status(200).json({ message: 'Attendance added successfully' });
  } catch (err) {
    console.error('Error adding attendance', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/aeas', async (req, res) => {
  const { fullName, phoneNumber, password, idNumber, dob, address, payrollType, salary, currency, admin_id } = req.body;

  // Log the received request body
  console.log('Request Body:', req.body);

  if (!fullName || !phoneNumber || !password || !idNumber || !dob || !address || !payrollType || !salary || !currency || !admin_id) {
    console.error('Invalid data:', {
      fullName, phoneNumber, password, idNumber, dob, address, payrollType, salary, currency, admin_id
    });
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {
    console.log('Preparing to insert employee and salary...');

    const query = `
      WITH inserted_employee AS (
        INSERT INTO public.employees (name, phone, password, cmnd, birth_date, address, admin_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id AS employee_id
      )
      INSERT INTO public.salaries (employee_id, type, salary, currency)
      SELECT employee_id, $8 AS type, $9 AS salary, $10 AS currency FROM inserted_employee;
    `;

    const values = [fullName, phoneNumber, password, idNumber, dob, address, admin_id, payrollType, salary, currency];
    
    console.log('Query:', query);
    console.log('Values:', values);

    const result = await client.query(query, values);

    console.log('Query Result:', result);

    res.status(201).json({ message: 'Employee and salary added successfully' });
  } catch (error) {
    console.error('Error inserting employee and salary:', error.message);
    console.error('Stack Trace:', error.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/login', async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return res.status(400).json({ error: 'Phone number and password are required' });
  }

  try {
    const query = 'SELECT * FROM admins WHERE phone = $1';
    const result = await client.query(query, [phoneNumber]);

    if (result.rows.length === 0) {
      // Return a generic message to avoid revealing phone number existence
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const admin = result.rows[0];

    // Directly compare plain text passwords
    if (password !== admin.password) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    res.status(200).json({ message: 'Login successful', admin });
  } catch (err) {
    console.error('Error logging in:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/employees', async (req, res) => {
  try {
    const { admin_id } = req.query;

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id not provided' });
    }

    const query = `
      SELECT
        e.id,
        e.name,
        e.phone,
        e.password,
        e.cmnd,
        e.birth_date,
        e.address,
        e.admin_id,
        s.type,
        s.salary,
        s.currency
      FROM public.employees e
      LEFT JOIN public.salaries s ON e.id = s.employee_id
      WHERE e.admin_id = $1
      ORDER BY e.id
    `;

    const result = await client.query(query, [admin_id]);

    // Định dạng kết quả để phù hợp với cấu trúc mong muốn
    const formattedResults = [];
    let currentEmployee = null;

    result.rows.forEach(row => {
      if (!currentEmployee || currentEmployee.id !== row.id) {
        if (currentEmployee) {
          formattedResults.push(currentEmployee);
        }

        currentEmployee = {
          id: row.id,
          name: row.name,
          phone: row.phone,
          password: row.password,
          cmnd: row.cmnd,
          birth_date: row.birth_date, // Định dạng ngày thành YYYY-MM-DD
          address: row.address,
          admin_id: row.admin_id,
          type: row.type === 'Tháng' ? 'Tháng' : 'Ngày', // Đảm bảo type phù hợp với output mong muốn
          amount: parseFloat(row.salary), // Đảm bảo salary là số
          currency: row.currency        };
      }

     });

    // Đẩy employee cuối cùng vào mảng kết quả
    if (currentEmployee) {
      formattedResults.push(currentEmployee);
    }

    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching data', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// Start server
app.put('/updateEmployee', async (req, res) => {
  const { employee_id, field, value } = req.body;

  if (!employee_id || !field || value === undefined) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {
    let query;
    if (['name', 'phone', 'password', 'cmnd', 'birth_date', 'address'].includes(field)) {
      query = `UPDATE employees SET ${field} = $2 WHERE id = $1`;
    } else if (['type', 'salary', 'currency'].includes(field)) {
      query = `UPDATE salaries SET ${field} = $2 WHERE employee_id = $1`;
    } else {
      return res.status(400).json({ error: 'Invalid field' });
    }

    await client.query(query, [employee_id, value]);
    res.status(200).json({ message: 'Employee information updated successfully' });
  } catch (err) {
    console.error('Error updating employee information', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// API để khóa nhân viên
app.put('/employeesunactive', async (req, res) => {
  const { employee_id } = req.body;

  if (!employee_id) {
    return res.status(400).json({ error: 'employee_id is required' });
  }

  try {
    const result = await client.query(
      'UPDATE employees SET active_status = $1 WHERE id = $2',
      ['unactive', employee_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ message: 'Employee locked successfully' });
  } catch (error) {
    console.error('Error locking employee:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API để lấy danh sách nhân viên (id và tên)
app.get('/employeesnameidforlock', async (req, res) => {
  try {
    const result = await client.query('SELECT id, name FROM employees');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API để mở khóa nhân viên
app.put('/employeesactive', async (req, res) => {
  const { employee_id } = req.body;

  if (!employee_id) {
    return res.status(400).json({ error: 'employee_id is required' });
  }

  try {
    const result = await client.query(
      'UPDATE employees SET active_status = $1 WHERE id = $2',
      ['active', employee_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ message: 'Employee unlocked successfully' });
  } catch (error) {
    console.error('Error unlocking employee:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/employeetabscreen', async (req, res) => {
  try {
    // Lấy admin_id từ query parameters
    const { admin_id } = req.query;
    
    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id not provided' });
    }

    // Thực hiện truy vấn SQL
    const query = `
      SELECT e.id, e.name, e.balance, s.type
      FROM employees e
      JOIN salaries s ON e.id = s.employee_id
      WHERE e.admin_id = $1
    `;
    const result = await client.query(query, [admin_id]);

    // Trả kết quả truy vấn
    res.json(result.rows);
  } catch (error) {
    console.error('Error executing query', error.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/refreshbalance', async (req, res) => {
  try {
      await client.query('BEGIN');

      const query = `
      WITH recent_payment AS (
          SELECT e.id AS employee_id,
                 COALESCE(MAX(p.date), e.initiated_date) AS start_date
          FROM employees e
          LEFT JOIN payments_history p ON e.id = p.employee_id
          GROUP BY e.id
      ), 
      total_salary AS (
          SELECT a.employee_id,
                 SUM(a.salaryinday) AS total_salary
          FROM attendance a
          JOIN recent_payment rp ON a.employee_id = rp.employee_id AND a.date >= rp.start_date AND a.date <= CURRENT_DATE
          GROUP BY a.employee_id
      )
      UPDATE employees
      SET balance = (
          SELECT COALESCE(ts.total_salary, 0) AS total_salary
          FROM total_salary ts
          WHERE employees.id = ts.employee_id
      )
      WHERE EXISTS (
          SELECT 1
          FROM total_salary ts
          WHERE employees.id = ts.employee_id
      );
      `;

      await client.query(query);
      await client.query('COMMIT');

      res.status(200).send('Balance updated successfully');
  } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating balance:', error);
      res.status(500).send('Internal Server Error');
  }
});
app.post('/logine', async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return res.status(400).json({ error: 'Phone number and password are required' });
  }

  try {
    const query = 'SELECT * FROM employees WHERE phone = $1';
    const result = await client.query(query, [phoneNumber]);

    if (result.rows.length === 0) {
      // Return a generic message to avoid revealing phone number existence
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const employee = result.rows[0];

    // Directly compare plain text passwords
    if (password !== employee.password) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    res.status(200).json({ message: 'Login successful', employee });
  } catch (err) {
    console.error('Error logging in:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
