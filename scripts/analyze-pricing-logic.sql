-- Abe's pricing logic analysis: bid price + lead time + FOB + weight + solicitation qty
-- Join quote_metrics_1_view which has bid + award + vendor cost in one row
SELECT TOP 5000
  fsc_k08 AS fsc,
  niin_k08 AS niin,
  p_desc_k08 AS description,
  weight_k08 AS item_weight,
  solqty_k34 AS solicitation_qty,
  fobcod_k34 AS fob_code,
  up_k35 AS bid_price,
  daro_k35 AS lead_time_days,
  qty_k35 AS bid_qty,
  uptime_k34 AS bid_date,
  awd_up_kc4 AS award_price,
  awdqty_kc4 AS award_qty,
  cntrct_kc4 AS contract_number,
  untcst_k57 AS vendor_cost,
  su_lbs_k56 AS shipping_weight_lbs,
  source_k09 AS solicitation_source
FROM quote_metrics_1_view
WHERE up_k35 > 0
ORDER BY uptime_k34 DESC
