-- Los 5 sectores definitivos de Crucita, con los pines que David marcó en Google Maps (8 oct 2026):
-- La Boca, Las Gilces, Los Arenales, Malecón de Crucita (las letras) y La Loma (parapente).
-- Se retiran Centro, Playa y San Jacinto. Las referencias desde viajes y tricimotos son
-- ON DELETE SET NULL, así que borrar estos sectores no rompe filas existentes.

update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.52098189 -0.80147852)') where id = 'la_boca';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.52405601 -0.82141437)') where id = 'las_gilces';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.53186699 -0.85675720)') where id = 'los_arenales';

insert into public.sectores (id, zona_id, nombre, centro, color_marcador) values
  ('malecon', 'crucita', 'Malecón de Crucita', extensions.st_geogfromtext('SRID=4326;POINT(-80.53995042 -0.86998380)'), '#14B8A6'),
  ('la_loma', 'crucita', 'La Loma',             extensions.st_geogfromtext('SRID=4326;POINT(-80.54802452 -0.88463806)'), '#10B981');

delete from public.sectores where id in ('centro', 'playa', 'san_jacinto');
