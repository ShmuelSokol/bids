-- dbo.packing_list_line_item_1_view



/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */

/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */


/* view packing_list_line_item_1_view: add view */
CREATE VIEW [dbo].[packing_list_line_item_1_view]
AS
SELECT     dbo.packing_list_line_item_0_view.mrbnum_kbj, dbo.packing_list_line_item_0_view.plr_no_k98, dbo.k90_tab.idnk90_k90, 
                      dbo.packing_list_line_item_0_view.idnk98_k98, dbo.packing_list_line_item_0_view.idnkbj_kbj, dbo.packing_list_line_item_0_view.idnkbh_kbh, 
                      dbo.packing_list_line_item_0_view.idnwhs_k98, dbo.packing_list_line_item_0_view.ffwder_k98
FROM         dbo.packing_list_line_item_0_view INNER JOIN
                      dbo.k90_tab ON dbo.packing_list_line_item_0_view.idnrcv_kbh = dbo.k90_tab.idnk90_k90 AND dbo.packing_list_line_item_0_view.rcvtab_kbh = 'k90'


















