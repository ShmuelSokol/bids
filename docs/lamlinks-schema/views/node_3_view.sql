-- dbo.node_3_view



/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */

/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */


/* view node_3_view: add view */
CREATE VIEW [dbo].[node_3_view]
AS
SELECT     dbo.k71_tab.idnk08_k71 AS idnk08_k08, dbo.node_2_view.catitl_pop, dbo.node_2_view.nodnam_pop, dbo.node_2_view.catitl_son, dbo.node_2_view.nodnam_son, 
                      dbo.node_2_view.seq_no_kam, dbo.node_2_view.tpltbl_pop, dbo.node_2_view.idntpl_pop, dbo.node_2_view.tpltbl_son, dbo.node_2_view.idntpl_son, 
                      dbo.node_2_view.idnkan_pop, dbo.node_2_view.idnkan_son, dbo.node_2_view.idnkal_pop, dbo.node_2_view.idnkal_son, dbo.node_2_view.idnkam_kam, 
                      dbo.node_2_view.idnkcl_pop, dbo.node_2_view.tblsnx_pop, dbo.node_2_view.idnsnx_pop, dbo.node_2_view.soncnt_son
FROM         dbo.node_2_view INNER JOIN
                      dbo.k90_tab ON dbo.node_2_view.tblsnx_pop = 'k90' AND dbo.k90_tab.idnk90_k90 = dbo.node_2_view.idnsnx_pop INNER JOIN
                      dbo.k71_tab ON dbo.k90_tab.idnk71_k90 = dbo.k71_tab.idnk71_k71


















