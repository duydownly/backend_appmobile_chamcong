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

      currentEmployee.attendance.push({
        date: row.attendance_date,
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

  if (!fullName || !phoneNumber || !password || !idNumber || !dob || !address || !payrollType || !salary || !currency || !admin_id) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {
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

    await client.query(query, values);

    res.status(201).json({ message: 'Employee and salary added successfully' });
  } catch (error) {
    console.error('Error inserting employee and salary:', error);
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
