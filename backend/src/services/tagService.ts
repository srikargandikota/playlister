import { query } from "../db/pool";

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  type: string;
  color: string | null;
  icon: string | null;
}

export async function listTags(userId: string): Promise<Tag[]> {
  return query<Tag>("SELECT * FROM tags WHERE user_id = $1 ORDER BY name ASC", [userId]);
}

export async function createTag(params: {
  userId: string;
  name: string;
  type: string;
  color?: string | null;
  icon?: string | null;
}): Promise<Tag> {
  const rows = await query<Tag>(
    "INSERT INTO tags (user_id, name, type, color, icon) VALUES ($1, $2, $3, $4, $5) " +
      "ON CONFLICT (user_id, name) DO UPDATE SET type = EXCLUDED.type, color = EXCLUDED.color, icon = EXCLUDED.icon " +
      "RETURNING *",
    [params.userId, params.name, params.type, params.color ?? null, params.icon ?? null]
  );
  return rows[0];
}

export async function addTagsToTrack(params: {
  userId: string;
  trackId: string;
  tagIds: string[];
}): Promise<void> {
  for (const tagId of params.tagIds) {
    await query(
      "INSERT INTO track_tags (user_id, track_id, tag_id) VALUES ($1, $2, $3) " +
        "ON CONFLICT (user_id, track_id, tag_id) DO NOTHING",
      [params.userId, params.trackId, tagId]
    );
  }
}

export async function removeTagFromTrack(params: {
  userId: string;
  trackId: string;
  tagId: string;
}): Promise<void> {
  await query("DELETE FROM track_tags WHERE user_id = $1 AND track_id = $2 AND tag_id = $3", [
    params.userId,
    params.trackId,
    params.tagId,
  ]);
}

