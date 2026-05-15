// Minimal Supabase upload test for gradepersem.png
import { createClient } from '../lib/supabase/client';
import fs from 'fs';

async function uploadTest() {
  const supabase = createClient();
  const filePath = 'docs/gradepersem.png';
  const fileBuffer = fs.readFileSync(filePath);
  const file = new File([fileBuffer], 'gradepersem.png', { type: 'image/png' });
  const uploadPath = `test-uploads/${Date.now()}-gradepersem.png`;
  const { error, data } = await supabase.storage.from('papers').upload(uploadPath, file);
  if (error) {
    console.error('Upload error:', error);
  } else {
    console.log('Upload success:', data);
  }
}

uploadTest();
