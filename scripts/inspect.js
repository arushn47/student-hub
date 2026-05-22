const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars!", { supabaseUrl, supabaseKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // Get profiles to see preferences
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
    if (pErr) throw pErr;
    console.log("PROFILES PREFERENCES:");
    profiles.forEach(p => {
      console.log(`User: ${p.id}, Preferences:`, JSON.stringify(p.preferences, null, 2));
    });

    // Get semesters
    const { data: semesters, error: sErr } = await supabase.from('semesters').select('*');
    if (sErr) throw sErr;
    console.log("\nSEMESTERS:");
    console.log(semesters);

    // Get schedules
    const { data: schedules, error: cErr } = await supabase.from('class_schedules').select('*');
    if (cErr) throw cErr;
    console.log("\nCLASS SCHEDULES:");
    schedules.forEach(s => {
      console.log(`ID: ${s.id}, Name: ${s.name}, Day: ${s.day_of_week}, SemID: ${s.semester_id}`);
    });

    // Get breaks
    const { data: breaks, error: bErr } = await supabase.from('semester_breaks').select('*');
    if (bErr) throw bErr;
    console.log("\nSEMESTER BREAKS:");
    console.log(breaks);

  } catch (err) {
    console.error("Error executing inspection:", err);
  }
}

run();
