-- dbo.rfq_2_query



/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */

/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */


/* view rfq_2_query: add view */
CREATE VIEW [dbo].[rfq_2_query]
AS
SELECT DISTINCT 
                      dbo.kc4_tab.idnkc4_kc4, dbo.k43_tab.idnk43_k43, dbo.k10_tab.sol_no_k10, dbo.k42_tab.rfq_no_k42, dbo.k08_tab.niin_k08, dbo.k08_tab.p_cage_k08, 
                      dbo.k08_tab.partno_k08, dbo.k42_tab.idnk42_k42
FROM         dbo.k37_tab INNER JOIN
                      dbo.k45_tab ON dbo.k37_tab.idnk37_k37 = dbo.k45_tab.idnk37_k45 INNER JOIN
                      dbo.k43_tab ON dbo.k45_tab.idnk43_k45 = dbo.k43_tab.idnk43_k43 INNER JOIN
                      dbo.k11_tab ON dbo.k37_tab.idnvrq_k37 = dbo.k11_tab.idnk11_k11 INNER JOIN
                      dbo.kc4_tab ON dbo.k11_tab.idnk08_k11 = dbo.kc4_tab.idnk08_kc4 INNER JOIN
                      dbo.k10_tab ON dbo.k11_tab.idnk10_k11 = dbo.k10_tab.idnk10_k10 AND dbo.kc4_tab.idnk10_kc4 = dbo.k10_tab.idnk10_k10 INNER JOIN
                      dbo.k42_tab ON dbo.k43_tab.idnk42_k43 = dbo.k42_tab.idnk42_k42 INNER JOIN
                      dbo.k40_tab ON dbo.k43_tab.idnk40_k43 = dbo.k40_tab.idnk40_k40 INNER JOIN
                      dbo.k08_tab ON dbo.k40_tab.idnk08_k40 = dbo.k08_tab.idnk08_k08
WHERE     (dbo.k37_tab.vrqtyp_k37 = 'k11')


















