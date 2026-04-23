-- dbo.shipping_request_line_3_view



/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */

/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */


/* view shipping_request_line_3_view: add view */
CREATE VIEW [dbo].[shipping_request_line_3_view]
AS
SELECT DISTINCT 
                      dbo.shipping_request_line_2_view.sprnum_kcu, dbo.shipping_request_line_2_view.srsdte_kcu, dbo.shipping_request_line_2_view.srssta_kcu, 
                      dbo.shipping_request_line_2_view.srl_no_kcv, dbo.shipping_request_line_2_view.srlqty_kcv, dbo.shipping_request_line_2_view.rtnsta_kcv, 
                      dbo.shipping_request_line_2_view.rtndte_kcv, dbo.supplier_po_part_1_view.s_code_k39 AS s_code_2po, 
                      dbo.supplier_po_part_1_view.e_name_k12 AS e_name_2po, dbo.supplier_po_part_1_view.por_no_k89 AS por_no_2po, 
                      dbo.supplier_po_part_1_view.idnk90_k90 AS idnk90_2po, dbo.qa_inspection_line_2_view.por_no_k89 AS por_no_1po, 
                      dbo.qa_inspection_line_2_view.e_code_vnd AS s_code_1po, dbo.qa_inspection_line_2_view.e_name_vnd AS e_name_1po, 
                      dbo.qa_inspection_line_2_view.idnk90_k90 AS idnk90_1po, dbo.supplier_po_part_1_view.fsc_k08 AS fsc_2po, dbo.supplier_po_part_1_view.niin_k08 AS niin_2po, 
                      dbo.supplier_po_part_1_view.prtnum_k71 AS prtnum_2po, dbo.supplier_po_part_1_view.p_desc_k71 AS p_desc_2po, 
                      dbo.qa_inspection_line_2_view.fsc_k08 AS fsc_1po, dbo.qa_inspection_line_2_view.niin_k08 AS niin_1po, 
                      dbo.qa_inspection_line_2_view.prtnum_k71 AS prtnum_1po, dbo.qa_inspection_line_2_view.p_desc_k71 AS p_desc_1po, 
                      dbo.shipping_request_line_2_view.idnkcu_kcu, dbo.supplier_po_part_1_view.idnk71_k71 AS idnk71_2po, dbo.shipping_request_line_2_view.idnk89_k89, 
                      dbo.supplier_po_part_1_view.idnk89_k89 AS idnk89_2po, dbo.shipping_request_line_2_view.ormnum_kcu
FROM         dbo.shipping_request_line_2_view INNER JOIN
                      dbo.qa_inspection_line_2_view ON dbo.shipping_request_line_2_view.idnsrs_kcv = dbo.qa_inspection_line_2_view.idnkcq_kcq AND 
                      dbo.shipping_request_line_2_view.srstab_kcv = 'kcq' INNER JOIN
                      dbo.supplier_po_part_1_view ON dbo.shipping_request_line_2_view.idnaft_kcv = dbo.supplier_po_part_1_view.idnk90_k90 AND 
                      dbo.shipping_request_line_2_view.afttab_kcv = 'k90'


















