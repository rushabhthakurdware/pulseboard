import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  // browsers send a preflight request first
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { workspaceId } = await req.json()
    if (!workspaceId) return json({ error: 'workspaceId is required' }, 400)

    // Client that acts AS THE CALLING USER (forwards their JWT),
    // so RLS applies: non-members get zero rows.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: messages, error } = await supabase
      .from('messages')
      .select('content, created_at, profiles(full_name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return json({ error: error.message }, 400)
    if (!messages?.length) return json({ summary: 'No messages to summarize yet.' })

    const transcript = messages
      .reverse()
      .map((m: any) => `${m.profiles?.full_name ?? 'Unknown'}: ${m.content}`)
      .join('\n')

      const prompt =
      'Summarize this team chat in 3-5 short bullet points. ' +
      'Then list any action items under "Action items:".\n\n' + transcript
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    )

     const result = await res.json()
    if (!res.ok) return json({ error: result.error?.message ?? 'LLM request failed' }, 502)

    const summary = result.candidates?.[0]?.content?.parts?.[0]?.text
    if (!summary) return json({ error: 'Empty response from model' }, 502)

    return json({ summary })  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})