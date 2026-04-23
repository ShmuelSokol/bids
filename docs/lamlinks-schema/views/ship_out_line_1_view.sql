-- dbo.ship_out_line_1_view



/* view ship_out_line_1_view: add view */


/* view ship_out_line_1_view: add view */


/* view ship_out_line_1_view: add view */

/* view ship_out_line_1_view: add view */


/* view ship_out_line_1_view: add view */


/* view ship_out_line_1_view: add view */


/* view ship_out_line_1_view: add view */
/* view ship_out_line_1_view: add view 
 view ship_out_line_1_view: add view 
 view a_1_view: add view */
CREATE VIEW [dbo].[ship_out_line_1_view]
AS
SELECT DISTINCT 
                         dbo.kcv_tab.rtnsta_kcv, dbo.kcv_tab.srlqty_kcv, dbo.kcv_tab.afttab_kcv, dbo.kcv_tab.idnaft_kcv, dbo.kcv_tab.idnkcv_kcv, dbo.ship_out_1_view.sprtyp_kcu, dbo.ship_out_1_view.sprnum_kcu, 
                         dbo.ship_out_1_view.ormnum_kcu, dbo.ship_out_1_view.srssta_kcu, dbo.ship_out_1_view.srsdte_kcu, dbo.ship_out_1_view.cactyp_kcw, dbo.ship_out_1_view.cactno_kcw, dbo.ship_out_1_view.idnkcu_kcu, 
                         dbo.ship_out_1_view.idnkcw_kcw, dbo.qa_inspection_line_3_view.fsc_k08, dbo.qa_inspection_line_3_view.niin_k08, dbo.qa_inspection_line_3_view.prtnum_k71, dbo.qa_inspection_line_3_view.p_desc_k71, 
                         dbo.qa_inspection_line_3_view.por_no_k89, dbo.qa_inspection_line_3_view.idnk93_rcv, dbo.qa_inspection_line_3_view.idnk93_imp, dbo.qa_inspection_line_3_view.idnk93_mad
FROM            dbo.kcv_tab INNER JOIN
                         dbo.ship_out_1_view ON dbo.kcv_tab.idnkcu_kcv = dbo.ship_out_1_view.idnkcu_kcu INNER JOIN
                         dbo.qa_inspection_line_3_view ON dbo.kcv_tab.idnsrs_kcv = dbo.qa_inspection_line_3_view.idnkcq_kcq







