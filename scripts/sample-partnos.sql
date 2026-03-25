SELECT TOP 200 LTRIM(RTRIM(partno_k08)) AS partno, p_cage_k08 AS cage,
       fsc_k08 AS fsc, niin_k08 AS niin, LTRIM(RTRIM(p_desc_k08)) AS descr
FROM k08_tab
WHERE fsc_k08 IN ('6515','6505','6510','6530','6550','6640','4240','5305','5310')
  AND LTRIM(RTRIM(partno_k08)) != ''
  AND LTRIM(RTRIM(niin_k08)) != ''
  AND LEN(LTRIM(RTRIM(partno_k08))) >= 5
ORDER BY fsc_k08, partno_k08
