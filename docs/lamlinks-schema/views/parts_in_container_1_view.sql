-- dbo.parts_in_container_1_view



/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */

/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */


/* view parts_in_container_1_view: add view */
CREATE VIEW [dbo].[parts_in_container_1_view]
AS
SELECT     K25_tab.clrnam_k25, Kaw_tab.socseq_kaw, Kaw_tab.subcnt_kaw, Kaw_tab.prtcnt_kaw, Kax_tab.prtcnt_kax, Kap_tab.catitl_kap, Kap_tab.catdes_kap, 
                      Kba_tab.boxdes_kba, Kaw_tab.soctbl_kaw, Kaw_tab.idnsoc_kaw, Kap_tab.idnkap_kap, Kaw_tab.idnkaw_kaw, K25_tab.rbgfun_k25, Kax_tab.bxptbl_kax, 
                      Kax_tab.idnbxp_kax, Kax_tab.idnkax_kax
FROM         dbo.kap_tab AS Kap_tab INNER JOIN
                      dbo.kba_tab AS Kba_tab ON Kap_tab.idnkap_kap = Kba_tab.idnkap_kba INNER JOIN
                      dbo.kaw_tab AS Kaw_tab ON Kba_tab.idnkba_kba = Kaw_tab.idnkba_kaw INNER JOIN
                      dbo.k25_tab AS K25_tab ON Kba_tab.idnk25_kba = K25_tab.idnk25_k25 INNER JOIN
                      dbo.kax_tab AS Kax_tab ON Kaw_tab.idnkaw_kaw = Kax_tab.idnkaw_kax


















