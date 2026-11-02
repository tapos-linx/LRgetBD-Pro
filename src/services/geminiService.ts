export async function verifyStatus(query: string) {
  const response = await fetch('/api/gemini/verify-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error('Failed to verify status');
  }
  return response.json();
}
