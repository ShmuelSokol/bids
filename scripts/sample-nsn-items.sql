SELECT TOP 5 partno_k08, p_cage_k08, fsc_k08, niin_k08, p_desc_k08
FROM k08_tab
WHERE LTRIM(RTRIM(partno_k08)) != ''
  AND LTRIM(RTRIM(niin_k08)) != ''
  AND fsc_k08 = '6515'
