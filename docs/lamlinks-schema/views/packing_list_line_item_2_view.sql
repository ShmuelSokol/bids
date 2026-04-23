-- dbo.packing_list_line_item_2_view



/* view packing_list_line_item_2_view: add view */


/* view packing_list_line_item_2_view: add view */


/* view packing_list_line_item_2_view: add view */

/* view packing_list_line_item_2_view: add view */


/* view packing_list_line_item_2_view: add view */


/* view packing_list_line_item_2_view: add view */


/* view packing_list_line_item_2_view: add view */


/* view packing_list_line_item_2_view: add view */


/* view packing_list_line_item_2_view: add view */


/* view packing_list_line_item_2_view: add view */
/* view packing_list_line_item_2_view: add view 
 view packing_list_line_item_2_view: add view 
 view packing_list_line_item_2_view: add view 
 view packing_list_line_item_2_view: add view 
 view packing_list_line_item_2_view: add view 
 view packing_list_line_item_2_view: add view 
 view packing_list_line_item_2_view: add view 
 view packing_list_line_item_2_view: add view */
CREATE VIEW [dbo].[packing_list_line_item_2_view]
AS
SELECT        dbo.packing_list_line_item_0_view.mrbnum_kbj, dbo.packing_list_line_item_0_view.plr_no_k98, dbo.clin_basic_1_view.cntrct_k79, dbo.clin_basic_1_view.rel_no_k80, dbo.clin_basic_1_view.clinno_k81, 
                         dbo.packing_list_line_item_0_view.idnk98_k98, dbo.packing_list_line_item_0_view.idnkbj_kbj, dbo.packing_list_line_item_0_view.idnkbh_kbh, dbo.packing_list_line_item_0_view.idnwhs_k98, 
                         dbo.packing_list_line_item_0_view.ffwder_k98, dbo.packing_list_line_item_0_view.locatn_kbh, dbo.packing_list_line_item_0_view.pklseq_kbh, dbo.packing_list_line_item_0_view.rcvqty_kbh, 
                         dbo.packing_list_line_item_0_view.rcvdte_k98, dbo.clin_basic_1_view.idnk81_k81, dbo.clin_basic_1_view.prtnum_k71, dbo.clin_basic_1_view.p_desc_k71, dbo.clin_basic_1_view.fsc_k08, 
                         dbo.clin_basic_1_view.niin_k08, dbo.clin_basic_1_view.piidno_k80
FROM            dbo.packing_list_line_item_0_view INNER JOIN
                         dbo.kcv_tab ON dbo.packing_list_line_item_0_view.idnrcv_kbh = dbo.kcv_tab.idnkcv_kcv AND dbo.packing_list_line_item_0_view.rcvtab_kbh = 'kcv' INNER JOIN
                         dbo.clin_basic_1_view ON dbo.kcv_tab.idnaft_kcv = dbo.clin_basic_1_view.idnk81_k81










