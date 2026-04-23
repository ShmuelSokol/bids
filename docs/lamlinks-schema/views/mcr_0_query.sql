-- dbo.mcr_0_query



/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */

/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */


/* view mcr_0_query: add view */
CREATE VIEW [dbo].[mcr_0_query]
AS
SELECT DISTINCT dbo.k13_tab.cage_k13 AS cage_mfg, dbo.k08_tab.idnk08_k08
FROM         dbo.k15_tab INNER JOIN
                      dbo.k13_tab ON dbo.k15_tab.idnk13_k15 = dbo.k13_tab.idnk13_k13 INNER JOIN
                      dbo.k08_tab ON dbo.k15_tab.idnk08_k15 = dbo.k08_tab.idnk08_k08


















