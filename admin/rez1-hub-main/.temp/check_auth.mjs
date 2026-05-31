import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
  const email = `test${Date.now()}@test.com`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'password123'
  });
  console.log('Signup error:', error);
  console.log('Session present?', !!data?.session);
}

testAuth();
