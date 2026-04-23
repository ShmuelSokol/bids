-- dbo.ph_0_query



/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */

/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */


/* view ph_0_query: add view */
CREATE VIEW [dbo].[ph_0_query]
AS
SELECT DISTINCT dbo.k08_tab.idnk08_k08, dbo.k13_tab.cage_k13 AS cage_vnd
FROM         dbo.k08_tab INNER JOIN
                      dbo.k30_tab ON dbo.k08_tab.idnk08_k08 = dbo.k30_tab.idnk08_k30 INNER JOIN
                      dbo.k13_tab ON dbo.k30_tab.idnk13_k30 = dbo.k13_tab.idnk13_k13


















