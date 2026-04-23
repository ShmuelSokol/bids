-- dbo.packing_list_line_item_0_view



/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */

/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */


/* view packing_list_line_item_0_view: add view */
CREATE VIEW [dbo].[packing_list_line_item_0_view]
AS
SELECT     Kbj_tab.mrbnum_kbj, K98_tab.plr_no_k98, K98_tab.idnk98_k98, Kbj_tab.idnkbj_kbj, Kbh_tab.idnkbh_kbh, K98_tab.idnwhs_k98, K98_tab.ffwder_k98, 
                      Kbh_tab.rcvtab_kbh, Kbh_tab.idnrcv_kbh, Kbh_tab.locatn_kbh, Kbh_tab.pklseq_kbh, Kbh_tab.rcvqty_kbh, K98_tab.rcvdte_k98
FROM         dbo.k98_tab AS K98_tab INNER JOIN
                      dbo.kbj_tab AS Kbj_tab ON K98_tab.idnkbj_k98 = Kbj_tab.idnkbj_kbj INNER JOIN
                      dbo.kbh_tab AS Kbh_tab ON K98_tab.idnk98_k98 = Kbh_tab.idnk98_kbh


















