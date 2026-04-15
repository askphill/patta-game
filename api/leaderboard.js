import { getTopTen } from '../lib/leaderboard.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const topTen = await getTopTen();

  return res.status(200).json({ topTen });
}
