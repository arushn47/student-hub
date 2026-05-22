const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function run() {
  const userId = 'e9ccb9ec-3950-41b9-8769-390e58985f3e';
  
  // Get attendance records
  const { data: records, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId);
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Total records for user: ${records.length}`);
  records.forEach(r => {
    console.log(`Record ID: ${r.id}, ClassID: ${r.class_schedule_id}, Date: ${r.date}, Status: ${r.status}`);
  });
}

run();
