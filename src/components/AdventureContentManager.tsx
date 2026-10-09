import React, { useEffect, useState } from 'react';
import { get, ref, set } from 'firebase/database';
import { database } from '../firebase';
import './AdventureContentManager.css';

const ADVENTURE_CONTENT_PATH = 'game_data/adventure_content/v1';

type WorldVideo = { enabled: boolean; trUrl: string; enUrl: string };
type World = {
  id: string;
  order: number;
  title: string;
  theme: string;
  enabled: boolean;
  scene: { backgroundId: string; heroId: string; guideId: string; introKey: string };
  videos: { intro: WorldVideo; outro: WorldVideo };
  missions: Record<string, unknown>;
};
type Journey = { id: string; order: number; title: string; enabled: boolean; worldIds: string[] };
type AdventureContent = { version: 1; updatedAt: number; worlds: Record<string, World>; journeys: Record<string, Journey> };

const emptyVideo = (): WorldVideo => ({ enabled: false, trUrl: '', enUrl: '' });

const worldSeed = [
  ['forest', 'Forest World', 'forest', 'Oliver'],
  ['tropical', 'Tropical Island', 'ocean', 'Lila'],
  ['volcano', 'Volcano Valley', 'volcano', 'Kora'],
  ['desert', 'Desert Dunes', 'cave', 'Zuzu'],
  ['ice', 'Ice World', 'ocean', 'Piko'],
  ['moon', 'Moon Base', 'space', 'Nova'],
] as const;

const createSeed = (): AdventureContent => ({
  version: 1,
  updatedAt: Date.now(),
  worlds: Object.fromEntries(worldSeed.map(([id, title, theme, guideId], order) => [id, {
    id,
    order,
    title,
    theme,
    enabled: true,
    scene: { backgroundId: `${id}-clean`, heroId: 'player', guideId: guideId.toLowerCase(), introKey: `adventure.storyWorlds.${id}.intro` },
    videos: { intro: emptyVideo(), outro: emptyVideo() },
    missions: {},
  }])) as Record<string, World>,
  journeys: {
    journey_1: { id: 'journey_1', order: 0, title: 'Grup 1', enabled: true, worldIds: worldSeed.map(([id]) => id) },
  },
});

const normalizeContent = (raw: Partial<AdventureContent> | null): AdventureContent => {
  const seed = createSeed();
  const storedWorlds = raw?.worlds || {};
  const allWorldIds = Array.from(new Set([...Object.keys(seed.worlds), ...Object.keys(storedWorlds)]));
  const worlds = Object.fromEntries(allWorldIds.map((id, order) => {
    const fallback = seed.worlds[id] || {
      id, order, title: 'Yeni Dünya', theme: 'forest', enabled: true,
      scene: { backgroundId: 'forest-clean', heroId: 'player', guideId: '', introKey: '' },
      videos: { intro: emptyVideo(), outro: emptyVideo() }, missions: {},
    };
    const stored = storedWorlds[id] as Partial<World> | undefined;
    return [id, {
      ...fallback,
      ...stored,
      scene: { ...fallback.scene, ...(stored?.scene || {}) },
      videos: {
        intro: { ...fallback.videos.intro, ...(stored?.videos?.intro || {}) },
        outro: { ...fallback.videos.outro, ...(stored?.videos?.outro || {}) },
      },
      missions: stored?.missions || fallback.missions,
    }];
  }));
  const storedJourneys = raw?.journeys || {};
  const journeys = Object.keys(storedJourneys).length
    ? Object.fromEntries(Object.entries(storedJourneys).map(([id, value]) => {
        const journey = value as Partial<Journey>;
        return [id, {
          id,
          order: Number(journey.order) || 0,
          title: journey.title || `Grup ${Number(journey.order || 0) + 1}`,
          enabled: journey.enabled !== false,
          worldIds: Array.isArray(journey.worldIds) ? journey.worldIds.filter((worldId) => Boolean(worlds[worldId])) : [],
        }];
      })) as Record<string, Journey>
    : { journey_1: { id: 'journey_1', order: 0, title: 'Grup 1', enabled: true, worldIds: Object.values(worlds).sort((a, b) => a.order - b.order).map((world) => world.id) } };
  return { version: 1, updatedAt: raw?.updatedAt || Date.now(), worlds, journeys };
};

const AdventureContentManager: React.FC = () => {
  const [content, setContent] = useState<AdventureContent>(createSeed());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const snapshot = await get(ref(database, ADVENTURE_CONTENT_PATH));
      setContent(normalizeContent(snapshot.exists() ? snapshot.val() : null));
      setMessage(snapshot.exists() ? 'İçerik Firebase’den yüklendi.' : 'Henüz içerik yok. Başlangıç dünyaları hazırlandı; Kaydet ile yayınlayabilirsin.');
    } catch (error) {
      setMessage(`İçerik yüklenemedi: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateWorld = (id: string, patch: Partial<World>) => {
    setContent(current => ({ ...current, worlds: { ...current.worlds, [id]: { ...current.worlds[id], ...patch } } }));
  };

  const updateVideo = (worldId: string, kind: 'intro' | 'outro', patch: Partial<WorldVideo>) => {
    setContent(current => {
      const world = current.worlds[worldId];
      return {
        ...current,
        worlds: {
          ...current.worlds,
          [worldId]: { ...world, videos: { ...world.videos, [kind]: { ...world.videos[kind], ...patch } } },
        },
      };
    });
  };

  const updateJourney = (journeyId: string, patch: Partial<Journey>) => {
    setContent((current) => ({ ...current, journeys: { ...current.journeys, [journeyId]: { ...current.journeys[journeyId], ...patch } } }));
  };

  const addJourney = () => {
    setContent((current) => {
      const order = Object.keys(current.journeys).length;
      const id = `journey_${Date.now()}`;
      return { ...current, journeys: { ...current.journeys, [id]: { id, order, title: `Grup ${order + 1}`, enabled: true, worldIds: [] } } };
    });
  };

  const addWorld = () => {
    setContent((current) => {
      const id = `world_${Date.now()}`;
      const order = Object.keys(current.worlds).length;
      return {
        ...current,
        worlds: {
          ...current.worlds,
          [id]: {
            id, order, title: `Yeni Dünya ${order + 1}`, theme: 'forest', enabled: true,
            scene: { backgroundId: 'forest-clean', heroId: 'player', guideId: '', introKey: '' },
            videos: { intro: emptyVideo(), outro: emptyVideo() }, missions: {},
          },
        },
      };
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      await set(ref(database, ADVENTURE_CONTENT_PATH), { ...content, version: 1, updatedAt: Date.now() });
      setMessage('✓ Macera ayarları yayınlandı. Uygulama bu veriyi otomatik alır.');
    } catch (error) {
      setMessage(`Kaydedilemedi: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adventure-manager">
      <div className="adventure-header">
        <div>
          <h2>🗺️ Macera Yönetimi</h2>
          <p>Grup, dünya hikâyesi ve uzaktan oynatılacak video bağlantılarını yönet.</p>
        </div>
        <div className="adventure-actions">
          <button className="adventure-secondary" onClick={load} disabled={loading || saving}>↻ Yenile</button>
          <button className="adventure-save" onClick={save} disabled={loading || saving}>{saving ? 'Kaydediliyor…' : '✓ Yayınla'}</button>
        </div>
      </div>

      {message && <div className="adventure-message">{message}</div>}
      {loading ? <div className="adventure-loading">Yükleniyor…</div> : (
        <>
        <section className="journey-settings">
          <div className="journey-settings-title"><div><h3>Yolculuk grupları</h3><p>Gruplar sırayla oynanır. Son açık grubun sonunda oyun tekrar başa dönmez.</p></div><button className="adventure-secondary" onClick={addJourney}>+ Grup ekle</button></div>
          {Object.values(content.journeys).sort((a, b) => a.order - b.order).map((journey, index) => (
            <div className="journey-card" key={journey.id}>
              <span className="world-order">{index + 1}</span>
              <label>Grup adı<input value={journey.title} onChange={(e) => updateJourney(journey.id, { title: e.target.value })} /></label>
              <label className="toggle-label"><input type="checkbox" checked={journey.enabled} onChange={(e) => updateJourney(journey.id, { enabled: e.target.checked })} /> Grup açık</label>
              <div className="journey-worlds">
                {Object.values(content.worlds).sort((a, b) => a.order - b.order).map((world) => <label key={world.id} className="journey-world-option"><input type="checkbox" checked={journey.worldIds.includes(world.id)} onChange={(e) => updateJourney(journey.id, { worldIds: e.target.checked ? [...journey.worldIds, world.id] : journey.worldIds.filter((id) => id !== world.id) })} /> {world.title}</label>)}
              </div>
            </div>
          ))}
        </section>
        <div className="world-settings-title"><h3>Dünyalar</h3><button className="adventure-secondary" onClick={addWorld}>+ Dünya ekle</button></div>
        <div className="world-settings-list">
          {Object.values(content.worlds).sort((a, b) => a.order - b.order).map((world) => (
            <section className="world-setting-card" key={world.id}>
              <div className="world-setting-title">
                <div>
                  <span className="world-order">{world.order + 1}</span>
                  <strong>{world.title}</strong>
                  <small> Rehber: {world.scene.guideId || '—'}</small>
                </div>
                <label className="toggle-label"><input type="checkbox" checked={world.enabled} onChange={(e) => updateWorld(world.id, { enabled: e.target.checked })} /> Dünya açık</label>
              </div>

              <div className="world-basic-fields">
                <label>Dünya adı<input value={world.title} onChange={(e) => updateWorld(world.id, { title: e.target.value })} /></label>
                <label>Rehber adı<input value={world.scene.guideId} onChange={(e) => updateWorld(world.id, { scene: { ...world.scene, guideId: e.target.value } })} /></label>
              </div>

              <div className="world-video-grid">
                {(['intro', 'outro'] as const).map((kind) => {
                  const video = world.videos[kind];
                  return <div className="world-video-card" key={kind}>
                    <div className="video-card-title"><strong>{kind === 'intro' ? '▶ Giriş videosu' : '🏁 Final videosu'}</strong><label className="toggle-label"><input type="checkbox" checked={video.enabled} onChange={(e) => updateVideo(world.id, kind, { enabled: e.target.checked })} /> Aktif</label></div>
                    <label>Türkçe doğrudan MP4 URL<input value={video.trUrl} placeholder="https://…/intro-tr.mp4" onChange={(e) => updateVideo(world.id, kind, { trUrl: e.target.value })} /></label>
                    <label>English direct MP4 URL<input value={video.enUrl} placeholder="https://…/intro-en.mp4" onChange={(e) => updateVideo(world.id, kind, { enUrl: e.target.value })} /></label>
                  </div>;
                })}
              </div>
            </section>
          ))}
        </div>
        </>
      )}
    </div>
  );
};

export default AdventureContentManager;
