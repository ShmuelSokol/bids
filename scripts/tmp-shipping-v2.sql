-- Shipping sync query: LamLinks → Supabase ll_shipments
--
-- Reconstructed 2026-04-14 from data/llk-discovery/columns.json and a sample
-- dump in data/llk-discovery/shipping-march.json. The consumer is
-- scripts/sync-shipping.ts which expects these exact output aliases:
--   ship_number, ship_status, ship_date, transport_mode, tracking, weight,
--   boxes, edi_id, qty, value, job_status, clin, fob, required_delivery,
--   contract, fsc, niin, description
--
-- Chain (outermost → innermost):
--   kaj_tab  (shipment header: ship#, status, date, carrier, tracking, box)
--   ka9_tab  (shipment line: qty + $ per line — FK kaj, ka8, k81)
--   ka8_tab  (job header: job_status)
--   k81_tab  (contract line: CLIN, FOB, required delivery — FK k80, k71)
--   k80_tab  (contract header: piidno = gov contract number)
--   k71_tab  (item cross-ref: FK k08)
--   k08_tab  (item master: FSC, NIIN, description)
--
-- TOP N is replaced with a higher limit at runtime by sync-shipping.ts.

SELECT TOP 50
    RTRIM(kaj.shpnum_kaj)                                AS ship_number,
    RTRIM(kaj.shpsta_kaj)                                AS ship_status,
    COALESCE(kaj.shptme_kaj, kaj.insdte_kaj)             AS ship_date,
    RTRIM(kaj.t_mode_kaj)                                AS transport_mode,
    RTRIM(kaj.trakno_kaj)                                AS tracking,
    COALESCE(kaj.pkg_wt_kaj, 0)                          AS weight,
    COALESCE(kaj.boxcnt_kaj, 1)                          AS boxes,
    RTRIM(kaj.edi_id_kaj)                                AS edi_id,
    COALESCE(ka9.jlnqty_ka9, k81.clnqty_k81, 0)          AS qty,
    COALESCE(ka9.xinval_ka9, ka9.selval_ka9, 0)          AS value,
    RTRIM(ka8.jobsta_ka8)                                AS job_status,
    RTRIM(k81.clinno_k81)                                AS clin,
    RTRIM(k81.fob_od_k81)                                AS fob,
    k81.reqdly_k81                                       AS required_delivery,
    RTRIM(k80.piidno_k80)                                AS contract,
    RTRIM(k08.fsc_k08)                                   AS fsc,
    RTRIM(k08.niin_k08)                                  AS niin,
    RTRIM(k08.p_desc_k08)                                AS description
FROM kaj_tab kaj
JOIN ka9_tab ka9  ON ka9.idnkaj_ka9 = kaj.idnkaj_kaj
JOIN ka8_tab ka8  ON ka8.idnka8_ka8 = ka9.idnka8_ka9
JOIN k81_tab k81  ON k81.idnk81_k81 = ka9.idnk81_ka9
LEFT JOIN k80_tab k80 ON k80.idnk80_k80 = k81.idnk80_k81
LEFT JOIN k71_tab k71 ON k71.idnk71_k71 = k81.idnk71_k81
LEFT JOIN k08_tab k08 ON k08.idnk08_k08 = k71.idnk08_k71
WHERE kaj.shpnum_kaj IS NOT NULL
  AND kaj.insdte_kaj >= DATEADD(day, -90, GETDATE())
ORDER BY kaj.idnkaj_kaj DESC;
