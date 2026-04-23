-- dbo.rfq_1_query



/* view rfq_1_query: add view */


/* view rfq_1_query: add view */


/* view rfq_1_query: add view */

/* view rfq_1_query: add view */
/* view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view 
 view rfq_1_query: add view */
CREATE VIEW dbo.rfq_1_query
AS
SELECT DISTINCT dbo.k11_tab.idnk11_k11, dbo.k42_tab.rfq_no_k42, dbo.k42_tab.rfquno_k42, dbo.k43_tab.idnk43_k43, dbo.k37_tab.idnk37_k37, dbo.k42_tab.idnk39_k42 AS idnk39_k39
FROM            dbo.k37_tab INNER JOIN
                         dbo.k45_tab ON dbo.k37_tab.idnk37_k37 = dbo.k45_tab.idnk37_k45 INNER JOIN
                         dbo.k43_tab ON dbo.k45_tab.idnk43_k45 = dbo.k43_tab.idnk43_k43 INNER JOIN
                         dbo.k11_tab ON dbo.k37_tab.idnvrq_k37 = dbo.k11_tab.idnk11_k11 INNER JOIN
                         dbo.k42_tab ON dbo.k43_tab.idnk42_k43 = dbo.k42_tab.idnk42_k42
WHERE        (dbo.k37_tab.vrqtyp_k37 = 'k11')




