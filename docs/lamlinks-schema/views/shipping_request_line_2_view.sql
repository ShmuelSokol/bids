-- dbo.shipping_request_line_2_view



/* view shipping_request_line_2_view: add view */


/* view shipping_request_line_2_view: add view */


/* view shipping_request_line_2_view: add view */

/* view shipping_request_line_2_view: add view */


/* view shipping_request_line_2_view: add view */


/* view shipping_request_line_2_view: add view */


/* view shipping_request_line_2_view: add view */
/* view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view 
 view shipping_request_line_2_view: add view */
CREATE VIEW [dbo].[shipping_request_line_2_view]
AS
SELECT        dbo.shipping_request_line_1_view.sprnum_kcu, dbo.qa_inspection_line_2_view.por_no_k89, dbo.qa_inspection_line_2_view.cnt_no_k89, dbo.qa_inspection_line_2_view.plr_no_k98, 
                         dbo.qa_inspection_line_2_view.qai_no_kcp, dbo.qa_inspection_line_2_view.qainum_kcp, dbo.qa_inspection_line_2_view.qal_no_kcq, dbo.qa_inspection_line_2_view.qastat_kcq, 
                         dbo.qa_inspection_line_2_view.u_name_iby, dbo.qa_inspection_line_2_view.u_name_aby, dbo.qa_inspection_line_2_view.idnk89_k89, dbo.qa_inspection_line_2_view.idnkcp_kcp, 
                         dbo.qa_inspection_line_2_view.idnkcq_kcq, dbo.qa_inspection_line_2_view.idnk71_k71, dbo.qa_inspection_line_2_view.dc1tab_kcq, dbo.qa_inspection_line_2_view.idndc1_kcq, 
                         dbo.qa_inspection_line_2_view.dc2tab_kcq, dbo.qa_inspection_line_2_view.idndc2_kcq, dbo.qa_inspection_line_2_view.qaista_kcp, dbo.qa_inspection_line_2_view.idnk90_k90, 
                         dbo.qa_inspection_line_2_view.idnk39_rcv, dbo.qa_inspection_line_2_view.idnk93_imp, dbo.qa_inspection_line_2_view.fsc_k08, dbo.qa_inspection_line_2_view.niin_k08, 
                         dbo.qa_inspection_line_2_view.prtnum_k71, dbo.qa_inspection_line_2_view.p_desc_k71, dbo.qa_inspection_line_2_view.e_code_mfg, dbo.qa_inspection_line_2_view.idnk93_rcv, 
                         dbo.shipping_request_line_1_view.srstab_kcv, dbo.qa_inspection_line_2_view.po_dte_k89, dbo.shipping_request_line_1_view.srssta_kcu, dbo.qa_inspection_line_2_view.e_code_vnd, 
                         dbo.qa_inspection_line_2_view.e_name_vnd, dbo.shipping_request_line_1_view.rtnsta_kcv, dbo.shipping_request_line_1_view.idnkcu_kcu, dbo.shipping_request_line_1_view.srl_no_kcv, 
                         dbo.shipping_request_line_1_view.rtndte_kcv, dbo.shipping_request_line_1_view.sprtyp_kcu, dbo.shipping_request_line_1_view.rtnqty_kcv, dbo.shipping_request_line_1_view.srlqty_kcv, 
                         dbo.shipping_request_line_1_view.afttab_kcv, dbo.shipping_request_line_1_view.idnaft_kcv, dbo.qa_inspection_line_2_view.qaixml_kcp, dbo.qa_inspection_line_2_view.qalxml_kcq, 
                         dbo.shipping_request_line_1_view.idnsrs_kcv, dbo.shipping_request_line_1_view.srsdte_kcu, dbo.shipping_request_line_1_view.idnkcv_kcv, dbo.shipping_request_line_1_view.idnkcw_kcw, 
                         dbo.shipping_request_line_1_view.ormnum_kcu
FROM            dbo.qa_inspection_line_2_view INNER JOIN
                         dbo.shipping_request_line_1_view ON dbo.qa_inspection_line_2_view.idnkcq_kcq = dbo.shipping_request_line_1_view.idnsrs_kcv AND dbo.shipping_request_line_1_view.srstab_kcv = 'kcq'







