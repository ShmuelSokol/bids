SELECT
  k08.fsc_k08 AS fsc_code,
  COUNT(DISTINCT k11.idnk11_k11) AS solicitations_received,
  COUNT(DISTINCT k34.idnk34_k34) AS bids_placed,
  CAST(COUNT(DISTINCT k34.idnk34_k34) AS FLOAT)
    / NULLIF(COUNT(DISTINCT k11.idnk11_k11), 0) * 100 AS bid_rate_pct,
  COUNT(DISTINCT CASE WHEN k11.closes_k11 >= DATEADD(month, -6, GETDATE()) THEN k11.idnk11_k11 END) AS sols_last_6mo,
  COUNT(DISTINCT CASE WHEN k11.closes_k11 >= DATEADD(month, -6, GETDATE()) THEN k34.idnk34_k34 END) AS bids_last_6mo
FROM k11_tab k11
JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
LEFT JOIN k34_tab k34 ON k11.idnk11_k11 = k34.idnk11_k34
WHERE k08.fsc_k08 IS NOT NULL AND LTRIM(RTRIM(k08.fsc_k08)) != ''
GROUP BY k08.fsc_k08
ORDER BY sols_last_6mo DESC
