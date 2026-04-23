-- dbo.container_3_view



/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */

/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */


/* view container_3_view: add view */
CREATE VIEW [dbo].[container_3_view]
AS
SELECT     dbo.container_1_view.catitl_kap, dbo.container_1_view.prtcnt_kaw, dbo.container_1_view.shpft3_kaw, dbo.container_1_view.shp_wt_kaw, 
                      dbo.container_1_view.boxino_kaw, dbo.container_1_view.boxdes_kba, dbo.container_1_view.boxxno_kaw, dbo.kaz_tab.x_rhex_kaz, 
                      dbo.container_1_view.idnkaw_kaw, dbo.kaz_tab.idnkaz_kaz, dbo.container_1_view.soctbl_kaw, dbo.container_1_view.idnsoc_kaw
FROM         dbo.container_1_view LEFT OUTER JOIN
                      dbo.kaz_tab ON dbo.kaz_tab.idnxcs_kaz = dbo.container_1_view.idnkaw_kaw AND dbo.kaz_tab.xcstbl_kaz = 'kaw'


















