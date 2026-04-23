-- dbo.qa_inspection_line_3_view



/* view qa_inspection_line_3_view: add view */


/* view qa_inspection_line_3_view: add view */


/* view qa_inspection_line_3_view: add view */

/* view qa_inspection_line_3_view: add view */


/* view qa_inspection_line_3_view: add view */


/* view qa_inspection_line_3_view: add view */


/* view qa_inspection_line_3_view: add view */


/* view qa_inspection_line_3_view: add view */


/* view qa_inspection_line_3_view: add view */
CREATE VIEW [dbo].[qa_inspection_line_3_view]
AS
SELECT DISTINCT 
                         dbo.inventory_part_received_1_view.por_no_k89, dbo.inventory_part_received_1_view.cnt_no_k89, dbo.inventory_part_received_1_view.plr_no_k98, dbo.qa_inspection_line_1_view.qai_no_kcp, 
                         dbo.qa_inspection_line_1_view.qainum_kcp, dbo.qa_inspection_line_1_view.qal_no_kcq, dbo.qa_inspection_line_1_view.qastat_kcq, dbo.qa_inspection_line_1_view.u_name_iby, 
                         dbo.qa_inspection_line_1_view.u_name_aby, dbo.inventory_part_received_1_view.idnk89_k89, dbo.qa_inspection_line_1_view.idnkcp_kcp, dbo.qa_inspection_line_1_view.idnkcq_kcq, 
                         dbo.qa_inspection_line_1_view.idnk71_k71, dbo.qa_inspection_line_1_view.dc1tab_kcq, dbo.qa_inspection_line_1_view.idndc1_kcq, dbo.qa_inspection_line_1_view.dc2tab_kcq, 
                         dbo.qa_inspection_line_1_view.idndc2_kcq, dbo.qa_inspection_line_1_view.qaista_kcp, dbo.inventory_part_received_1_view.idnk90_k90, dbo.inventory_part_received_1_view.instat_k93 AS instat_rcv, 
                         dbo.inventory_part_received_1_view.idnk39_k39 AS idnk39_rcv, dbo.qa_inspection_line_1_view.fsc_k08, dbo.qa_inspection_line_1_view.niin_k08, dbo.qa_inspection_line_1_view.prtnum_k71, 
                         dbo.qa_inspection_line_1_view.p_desc_k71, dbo.qa_inspection_line_1_view.e_code_mfg, dbo.inventory_part_received_1_view.idnk93_k93 AS idnk93_rcv, 
                         dbo.inventory_part_imported_1_view.idnk93_k93 AS idnk93_imp, dbo.inventory_part_made_1_view.idnk93_k93 AS idnk93_mad, dbo.inventory_part_received_1_view.e_code_vnd, 
                         dbo.inventory_part_received_1_view.e_name_vnd, dbo.inventory_part_received_1_view.po_dte_k89, dbo.qa_inspection_line_1_view.idnk14_iby, dbo.inventory_part_received_1_view.idnk98_k98
FROM            dbo.qa_inspection_line_1_view LEFT OUTER JOIN
                         dbo.inventory_part_made_1_view ON dbo.qa_inspection_line_1_view.idnkcp_kcp = dbo.inventory_part_made_1_view.idnkab_kab AND dbo.qa_inspection_line_1_view.dc2tab_kcq = 'kab' LEFT OUTER JOIN
                         dbo.inventory_part_received_1_view ON dbo.qa_inspection_line_1_view.idnk71_k71 = dbo.inventory_part_received_1_view.idnk71_k71 AND dbo.qa_inspection_line_1_view.dc1tab_kcq = 'k89' AND 
                         dbo.qa_inspection_line_1_view.idndc1_kcq = dbo.inventory_part_received_1_view.idnk89_k89 AND dbo.qa_inspection_line_1_view.dc2tab_kcq = 'k98' AND 
                         dbo.qa_inspection_line_1_view.idndc2_kcq = dbo.inventory_part_received_1_view.idnk98_k98 LEFT OUTER JOIN
                         dbo.inventory_part_imported_1_view ON dbo.qa_inspection_line_1_view.idnk71_k71 = dbo.inventory_part_imported_1_view.idnk71_k71 AND dbo.qa_inspection_line_1_view.dc1tab_kcq = 'k95' AND 
                         dbo.qa_inspection_line_1_view.idndc1_kcq = dbo.inventory_part_imported_1_view.idnk95_k95 AND dbo.qa_inspection_line_1_view.dc2tab_kcq = 'k99' AND 
                         dbo.qa_inspection_line_1_view.idndc2_kcq = dbo.inventory_part_imported_1_view.idnk99_k99









