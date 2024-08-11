const cron = require('node-cron');
const { client } = require('./db'); // Yêu cầu client từ db.js

// Lên lịch công việc để chạy vào lúc 6:15 PM giờ Việt Nam mỗi ngày
cron.schedule('10 15 * * *', async () => {  // Chạy mỗi phút
    console.log('Running cron job every minute');
  

  const query = `
    INSERT INTO attendance (employee_id, status, color, date)
    SELECT e.id, 'Vắng', 'red', TO_CHAR(NOW() + INTERVAL '07:00:00', 'YYYY-MM-DD')::date
    FROM employees e
    WHERE NOT EXISTS (
      SELECT 1
      FROM attendance a
      WHERE a.employee_id = e.id
      AND a.date = TO_CHAR(NOW() + INTERVAL '07:00:00', 'YYYY-MM-DD')::date
      AND a.status IS NOT NULL
      AND a.color IS NOT NULL
    );
  `;

  try {
    await client.query(query);
    console.log('Query executed successfully');
  } catch (err) {
    console.error('Error executing query', err.stack);
  }
}, {
  scheduled: true,
  timezone: "Asia/Ho_Chi_Minh"  // Chỉ định múi giờ Việt Nam
});
