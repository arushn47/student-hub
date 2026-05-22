const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

const getCourseCode = (name) => {
    const match = name.match(/([A-Z]{3,4}\d{4})/i)
    return match ? match[1].toUpperCase() : name.split(/[\s-]+/)[0].trim().toUpperCase()
}

async function run() {
  const userId = 'e9ccb9ec-3950-41b9-8769-390e58985f3e';
  
  const [classRes, attendanceRes, profileRes] = await Promise.all([
    supabase.from('class_schedules').select('*').eq('user_id', userId),
    supabase.from('attendance_records').select('*').eq('user_id', userId),
    supabase.from('profiles').select('preferences').eq('id', userId).single()
  ]);
  
  const classes = classRes.data || [];
  const records = attendanceRes.data || [];
  const preferences = profileRes.data?.preferences || {};
  
  console.log("preferences.base_attendance_date:", preferences.base_attendance_date);
  
  const filteredClasses = classes;
  const filteredRecords = records;
  
  // Calculate CSE3009-LTP
  const subjectName = 'CSE3009-LTP';
  const classIdsForSubject = filteredClasses
      .filter(c => c.name.toLowerCase().trim() === subjectName.toLowerCase().trim())
      .map(c => c.id)

  const relevantRecords = filteredRecords.filter(r =>
      r.class_schedule_id && classIdsForSubject.includes(r.class_schedule_id)
  )
  
  console.log("relevantRecords:", relevantRecords.map(r => ({ date: r.date, status: r.status })));

  const code = getCourseCode(subjectName)
  const base = preferences?.base_attendance?.[code]
  const baseAttendanceDate = base ? (preferences?.base_attendance_date || format(new Date(), 'yyyy-MM-dd')) : null

  console.log("base:", base);
  console.log("baseAttendanceDate:", baseAttendanceDate);

  const activeRecords = baseAttendanceDate
      ? relevantRecords.filter(r => r.date > baseAttendanceDate)
      : relevantRecords

  console.log("activeRecords:", activeRecords.map(r => ({ date: r.date, status: r.status })));

  let total = activeRecords.filter(r => r.status !== 'cancelled').length
  let present = activeRecords.filter(r => r.status === 'present').length
  let absent = activeRecords.filter(r => r.status === 'absent').length
  let cancelled = activeRecords.filter(r => r.status === 'cancelled').length

  // Wait! Let's check what preferences?.base_attendance has
  console.log("preferences?.base_attendance:", preferences?.base_attendance);

  if (preferences?.base_attendance?.[code]) {
      present += base.present
      total += base.total
      absent += (base.total - base.present)
  }

  const percentage = total > 0 ? Math.round((present / total) * 100) : 0
  const ceilPercentage = total > 0 ? Math.ceil((present / total) * 100) : 0

  console.log(`Stats - total: ${total}, present: ${present}, absent: ${absent}, cancelled: ${cancelled}, percentage (round): ${percentage}%, percentage (ceil): ${ceilPercentage}%`);
}

run();
