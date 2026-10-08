-- Centros de sector con los puntos reales que David marcó en Google Maps (8 oct 2026).
-- Crucita, La Boca y Las Gilces son puntos reales. Playa, Los Arenales y San Jacinto
-- siguen siendo PROVISIONALES (desplazados junto con el centro) hasta recibir su pin.
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.53690632 -0.86297781)') where id = 'centro';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.52098189 -0.80147852)') where id = 'la_boca';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.52405601 -0.82141437)') where id = 'las_gilces';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.5422 -0.8652)')       where id = 'playa';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.5347 -0.8702)')       where id = 'los_arenales';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.5307 -0.8782)')       where id = 'san_jacinto';
