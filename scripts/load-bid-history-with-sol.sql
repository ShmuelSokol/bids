SELECT TOP 10000
  LTRIM(RTRIM(sol_no_k10)) AS solicitation_number,
  k08.fsc_k08 + '-' + k08.niin_k08 AS nsn,
  k35.up_k35 AS bid_price,
  k35.daro_k35 AS lead_time_days,
  k35.qty_k35 AS bid_qty,
  k34.uptime_k34 AS bid_date,
  k34.fobcod_k34 AS fob_code,
  LTRIM(RTRIM(k08.p_desc_k08)) AS description
FROM k34_tab k34
JOIN k35_tab k35 ON k34.idnk34_k34 = k35.idnk34_k35
JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
WHERE k35.up_k35 > 0
ORDER BY k34.uptime_k34 DESC
