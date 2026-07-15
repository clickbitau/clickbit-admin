const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: WebSocket,
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.loginclickbit,
    password: process.env.passclickbit,
  });

  if (error) {
    console.error('Login error:', error.message);
    process.exit(1);
  }

  console.log(data.session.access_token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
