-- dbo.container_1_view



/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */

/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */


/* view container_1_view: add view */
CREATE VIEW [dbo].[container_1_view]
AS
SELECT     K25_tab.clrnam_k25, Kaw_tab.socseq_kaw, Kaw_tab.subcnt_kaw, Kaw_tab.prtcnt_kaw, Kap_tab.catitl_kap, Kap_tab.catdes_kap, Kba_tab.boxdes_kba, 
                      K25_tab.rbgfun_k25, Kaw_tab.box_wt_kaw, Kaw_tab.cnt_wt_kaw, Kaw_tab.shp_wt_kaw, Kaw_tab.shpft3_kaw, Kaw_tab.boxtat_kaw, Kaw_tab.boxino_kaw, 
                      Kaw_tab.boxxno_kaw, Kaw_tab.soctbl_kaw, Kaw_tab.idnsoc_kaw, Kap_tab.idnkap_kap, Kaw_tab.idnkaw_kaw, Kaw_tab.idnout_kaw, Kba_tab.idnkba_kba, 
                      Kaw_tab.pkglen_kaw, Kaw_tab.pkgwth_kaw, Kaw_tab.pkghth_kaw
FROM         dbo.k25_tab AS K25_tab INNER JOIN
                      dbo.kap_tab AS Kap_tab INNER JOIN
                      dbo.kba_tab AS Kba_tab ON Kap_tab.idnkap_kap = Kba_tab.idnkap_kba INNER JOIN
                      dbo.kaw_tab AS Kaw_tab ON Kba_tab.idnkba_kba = Kaw_tab.idnkba_kaw ON K25_tab.idnk25_k25 = Kba_tab.idnk25_kba


















