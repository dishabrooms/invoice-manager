import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req) {
  return new Promise((resolve) => {
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
      try {
        if (err) throw err;
        const invoiceId = fields.invoiceId || null;
        const file = files.file;
        if (!file) return resolve(new Response(JSON.stringify({ error: 'No file' }), { status: 400 }));

        const buffer = fs.readFileSync(file.filepath);
        const ext = (file.originalFilename || file.newFilename || 'file').split('.').pop();
        const filename = `${invoiceId || 'invoice'}_${Date.now()}.${ext}`;
        const bucket = 'invoices';

        // upload to Supabase Storage
        const { data: uploadData, error: upErr } = await supabase.storage.from(bucket).upload(filename, buffer, {
          contentType: file.mimetype
        });
        if (upErr) throw upErr;

        // store metadata
        const { error: dbErr } = await supabase.from('files').insert({
          invoice_id: invoiceId,
          filename,
          storage_path: uploadData.path,
          file_type: ext === 'pdf' ? 'pdf' : 'xlsx'
        });
        if (dbErr) throw dbErr;

        resolve(new Response(JSON.stringify({ ok: true, path: uploadData.path }), { status: 200 }));
      } catch (e) {
        console.error(e);
        resolve(new Response(JSON.stringify({ error: e.message }), { status: 500 }));
      }
    });
  });
}
