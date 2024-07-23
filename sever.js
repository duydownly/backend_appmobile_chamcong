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
    const query = `
      SELECT e.id, e.name, a.date AS attendance_date, a.status AS attendance_status, a.color AS attendance_color
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id
      ORDER BY e.id, a.date
    `;
    const result = await client.query(query);

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
    const query = `
      UPDATE attendance
      SET status = $3, color = $4
      WHERE employee_id = $1 AND date = $2
    `;
    await client.query(query, [employee_id, date, status, color]);
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
    const query = `
      INSERT INTO attendance (employee_id, date, status, color)
      VALUES ($1, $2, $3, $4)
    `;
    await client.query(query, [employee_id, date, status, color]);
    res.status(200).json({ message: 'Attendance added successfully' });
  } catch (err) {
    console.error('Error adding attendance', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/aeas', async (req, res) => {
  const { fullName, phoneNumber, password, idNumber, dob, address, payrollType, salary, payDate, admin_id } = req.body;

  if (!fullName || !phoneNumber || !password || !idNumber || !dob || !address || !payrollType || !salary || !payDate || !admin_id) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {

    const query = `
      WITH inserted_employee AS (
        INSERT INTO public.employees (name, phone, password, cmnd, birth_date, address, admin_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id AS employee_id
      )
      INSERT INTO public.salaries (employee_id, type, salary, pay_date)
      SELECT employee_id, $8 AS type, $9 AS salary, $10 AS pay_date FROM inserted_employee;
    `;

    const values = [fullName, phoneNumber, password, idNumber, dob, address, admin_id, payrollType, salary, payDate];

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
