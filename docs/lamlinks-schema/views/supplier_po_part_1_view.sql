-- dbo.supplier_po_part_1_view



/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */

/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */


/* view supplier_po_part_1_view: add view */
CREATE VIEW [dbo].[supplier_po_part_1_view]
AS
SELECT     dbo.part_2_view.fsc_k08, dbo.part_2_view.niin_k08, dbo.part_2_view.prtnum_k71, dbo.part_2_view.pn_rev_k71, dbo.part_2_view.p_desc_k71, 
                      dbo.supplier_po_1_view.s_code_k39, dbo.supplier_po_1_view.e_name_k12, dbo.supplier_po_1_view.por_no_k89, dbo.k90_tab.idnk90_k90, 
                      dbo.part_2_view.partno_k08, dbo.supplier_po_1_view.idnk89_k89, dbo.k90_tab.idnk57_k90, dbo.supplier_po_1_view.cnt_no_k89, dbo.part_2_view.idnk08_k08, 
                      dbo.k90_tab.polval_k90, dbo.k90_tab.qotdte_k90, dbo.k90_tab.qrefno_k90, dbo.k90_tab.partno_k90, dbo.k90_tab.popseq_k90, dbo.k90_tab.invk96_k90, 
                      dbo.supplier_po_1_view.idnk39_k39, dbo.supplier_po_1_view.idnk12_k12, dbo.k90_tab.snq_11_k90, dbo.k90_tab.soq_11_k90, dbo.k90_tab.pop_um_k90, 
                      dbo.supplier_po_1_view.po_dte_k89, dbo.k90_tab.popval_k90, dbo.part_2_view.idnk71_k71
FROM         dbo.supplier_po_1_view INNER JOIN
                      dbo.k90_tab ON dbo.supplier_po_1_view.idnk89_k89 = dbo.k90_tab.idnk89_k90 INNER JOIN
                      dbo.part_2_view ON dbo.k90_tab.idnk71_k90 = dbo.part_2_view.idnk71_k71


















