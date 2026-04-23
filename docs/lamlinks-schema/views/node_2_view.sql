-- dbo.node_2_view



/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */

/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */


/* view node_2_view: add view */
CREATE VIEW [dbo].[node_2_view]
AS
SELECT     TOP (100) PERCENT kap_pop.catitl_kap AS catitl_pop, kan_pop.nodnam_kan AS nodnam_pop, kap_son.catitl_kap AS catitl_son, 
                      kan_son.nodnam_kan AS nodnam_son, dbo.kam_tab.seq_no_kam, kan_pop.tpltbl_kan AS tpltbl_pop, kan_pop.idntpl_kan AS idntpl_pop, 
                      kan_son.tpltbl_kan AS tpltbl_son, kan_son.idntpl_kan AS idntpl_son, kan_pop.idnkan_kan AS idnkan_pop, kan_son.idnkan_kan AS idnkan_son, 
                      kan_pop.idnkal_kan AS idnkal_pop, kan_son.idnkal_kan AS idnkal_son, dbo.kam_tab.idnkam_kam, dbo.kcl_tab.idnkcl_kcl AS idnkcl_pop, 
                      dbo.kcl_tab.tblsnx_kcl AS tblsnx_pop, dbo.kcl_tab.idnsnx_kcl AS idnsnx_pop, kan_son.soncnt_kan AS soncnt_son
FROM         dbo.kap_tab AS kap_son INNER JOIN
                      dbo.kan_tab AS kan_son ON kap_son.idnkap_kap = kan_son.idnkap_kan LEFT OUTER JOIN
                      dbo.kam_tab ON kan_son.idnkan_kan = dbo.kam_tab.idnson_kam LEFT OUTER JOIN
                      dbo.kan_tab AS kan_pop ON dbo.kam_tab.idnpop_kam = kan_pop.idnkan_kan LEFT OUTER JOIN
                      dbo.kap_tab AS kap_pop ON kan_pop.idnkap_kan = kap_pop.idnkap_kap LEFT OUTER JOIN
                      dbo.kcl_tab ON dbo.kcl_tab.idnkan_kcl = kan_pop.idnkan_kan


















