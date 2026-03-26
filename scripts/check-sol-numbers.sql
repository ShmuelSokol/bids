SELECT TOP 20 sol_no_k10 AS sol_number, k34.uptime_k34 AS bid_date, k35.up_k35 AS bid_price
FROM k34_tab k34
JOIN k35_tab k35 ON k34.idnk34_k34 = k35.idnk34_k35
JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
WHERE k35.up_k35 > 0
ORDER BY k34.uptime_k34 DESC
