-- dbo.pha_1_view



/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */

/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */


/* view pha_1_view: add view */
CREATE VIEW [dbo].[pha_1_view]
AS
SELECT     dbo.k30_tab.cntrct_k30, dbo.k30_tab.cntdte_k30, dbo.k30_tab.qty_k30, dbo.k30_tab.up_k30, dbo.k30_tab.ui_k30, dbo.k13_tab.cage_k13, dbo.k13_tab.c_name_k13, 
                      dbo.k31_tab.c_code_k31, dbo.k30_tab.idnk08_k30, dbo.k08_tab.idnk08_k08, dbo.k13_tab.idnk12_k13 AS idnk12_k12, dbo.k13_tab.idnk13_k13, 
                      dbo.k30_tab.idnk30_k30, dbo.k31_tab.idnk12_k31
FROM         dbo.k30_tab INNER JOIN
                      dbo.k31_tab ON dbo.k30_tab.idnk31_k30 = dbo.k31_tab.idnk31_k31 INNER JOIN
                      dbo.k13_tab ON dbo.k30_tab.idnk13_k30 = dbo.k13_tab.idnk13_k13 INNER JOIN
                      dbo.k08_tab ON dbo.k30_tab.idnk08_k30 = dbo.k08_tab.idnk08_k08


















