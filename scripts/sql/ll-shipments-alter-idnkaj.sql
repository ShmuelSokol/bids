-- Add the LL shipment id (idnkaj_kaj) to ll_shipments so EDI transmissions
-- and POD records can be joined on LL's native PK rather than surrogate.
-- Also recreates ll_shipments_with_edi view using the new column.

ALTER TABLE ll_shipments ADD COLUMN IF NOT EXISTS idnkaj INTEGER;
CREATE INDEX IF NOT EXISTS ll_shipments_idnkaj_idx ON ll_shipments(idnkaj);

DROP VIEW IF EXISTS ll_shipments_with_edi;
CREATE VIEW ll_shipments_with_edi AS
SELECT
  s.*,
  COALESCE(wawf_856.status, 'Not Sent')                          AS wawf_856_status,
  wawf_856.transmitted_at                                        AS wawf_856_at,
  COALESCE(wawf_810.status, 'Not Sent')                          AS wawf_810_status,
  wawf_810.transmitted_at                                        AS wawf_810_at,
  CASE
    WHEN wawf_810.lifecycle = 'acknowledged'    THEN 'complete'
    WHEN wawf_810.lifecycle = 'problem'         THEN 'problem'
    WHEN wawf_810.lifecycle = 'sent'            THEN 'pending_ack'
    WHEN wawf_856.lifecycle = 'acknowledged'    THEN 'asn_ack_only'
    WHEN wawf_856.lifecycle IS NOT NULL         THEN 'in_flight'
    ELSE 'not_started'
  END                                                            AS edi_health
FROM ll_shipments s
LEFT JOIN LATERAL (
  SELECT t.status, t.transmitted_at, t.lifecycle
  FROM ll_edi_transmissions t
  WHERE t.parent_table = 'kaj'
    AND t.parent_id = s.idnkaj
    AND t.edi_type = '810'
  ORDER BY t.transmitted_at DESC
  LIMIT 1
) wawf_810 ON TRUE
LEFT JOIN LATERAL (
  SELECT t.status, t.transmitted_at, t.lifecycle
  FROM ll_edi_transmissions t
  WHERE t.parent_table = 'kaj'
    AND t.parent_id = s.idnkaj
    AND t.edi_type = '856'
  ORDER BY t.transmitted_at DESC
  LIMIT 1
) wawf_856 ON TRUE;
