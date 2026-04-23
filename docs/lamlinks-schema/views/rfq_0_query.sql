-- dbo.rfq_0_query



/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */

/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */


/* view rfq_0_query: add view */
CREATE VIEW [dbo].[rfq_0_query]
AS
SELECT DISTINCT dbo.k11_tab.idnk11_k11
FROM         dbo.k37_tab INNER JOIN
                      dbo.k45_tab ON dbo.k37_tab.idnk37_k37 = dbo.k45_tab.idnk37_k45 INNER JOIN
                      dbo.k43_tab ON dbo.k45_tab.idnk43_k45 = dbo.k43_tab.idnk43_k43 INNER JOIN
                      dbo.k11_tab ON dbo.k37_tab.idnvrq_k37 = dbo.k11_tab.idnk11_k11
WHERE     (dbo.k37_tab.vrqtyp_k37 = 'k11')


















