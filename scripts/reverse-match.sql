SELECT TOP 500 LTRIM(RTRIM(partno_k08)) AS partno, p_cage_k08 AS cage,
       fsc_k08 + '-' + niin_k08 AS nsn,
       fsc_k08 AS fsc,
       LTRIM(RTRIM(p_desc_k08)) AS descr
FROM k08_tab
WHERE LTRIM(RTRIM(partno_k08)) != ''
  AND LTRIM(RTRIM(niin_k08)) != ''
  AND LEN(LTRIM(RTRIM(partno_k08))) >= 6
  AND fsc_k08 IN ('6515','6505','6510','6530','6550','6640','4240','5305','5310','8010','8030','8040','8415','7930')
ORDER BY fsc_k08, partno_k08
