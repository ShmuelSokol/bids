-- dbo.inventory_part_imported_1_view



/* view inventory_part_imported_1_view: add view */


/* view inventory_part_imported_1_view: add view */


/* view inventory_part_imported_1_view: add view */

/* view inventory_part_imported_1_view: add view */


/* view inventory_part_imported_1_view: add view */


/* view inventory_part_imported_1_view: add view */


/* view inventory_part_imported_1_view: add view */


/* view inventory_part_imported_1_view: add view */


/* view inventory_part_imported_1_view: add view */
/* view inventory_part_imported_1_view: add view 
 view inventory_part_imported_1_view: add view 
 view inventory_part_imported_1_view: add view 
 view inventory_part_imported_1_view: add view 
 view inventory_part_imported_1_view: add view 
 view inventory_part_imported_1_view: add view 
 view inventory_part_imported_1_view: add view 
 view inventory_part_imported_1_view: add view 
 view inventory_part_imported_1_view: add view */
CREATE VIEW [dbo].[inventory_part_imported_1_view]
AS
SELECT        dbo.ka7_tab.d_code_ka7 AS e_code_imp, dbo.ka7_tab.d_name_ka7 AS e_name_imp, dbo.inventory_part_1_view.fsc_k08, dbo.inventory_part_1_view.niin_k08, dbo.inventory_part_1_view.prtnum_k71, 
                         dbo.inventory_part_1_view.p_desc_k71, dbo.inventory_part_1_view.e_code_mfg, dbo.inventory_part_1_view.snq_21_k93, dbo.inventory_part_1_view.isttbl_k93, dbo.inventory_part_1_view.idnist_k93, 
                         dbo.inventory_part_1_view.idnk71_k71, dbo.inventory_part_1_view.soq_21_k93, dbo.inventory_part_1_view.idnk93_k93, dbo.k95_tab.nni_no_k95, dbo.k95_tab.nnxdte_k95, dbo.k95_tab.effdte_k95, 
                         dbo.k95_tab.nnista_k95, dbo.k99_tab.nnlqty_k99, dbo.k99_tab.nnlval_k99, dbo.k95_tab.idnk95_k95, dbo.k99_tab.idnk99_k99, dbo.ka7_tab.idnka7_ka7, dbo.ka7_tab.gduset_ka7 AS gduset_imp, 
                         dbo.ka7_tab.idnk12_ka7 AS idnk12_imp, dbo.k99_tab.cnt_no_k99, dbo.inventory_part_1_view.d_name_whs AS d_name_imp, dbo.inventory_part_1_view.ictref_kbb AS ictref_imp, 
                         dbo.inventory_part_1_view.invsta_k93 AS invsta_imp, dbo.inventory_part_1_view.locatn_kbc AS locatn_imp, dbo.inventory_part_1_view.instat_k93 AS instat_imp
FROM            dbo.inventory_part_1_view INNER JOIN
                         dbo.k99_tab ON dbo.inventory_part_1_view.idnist_k93 = dbo.k99_tab.idnk99_k99 INNER JOIN
                         dbo.k95_tab ON dbo.k99_tab.idnk95_k99 = dbo.k95_tab.idnk95_k95 INNER JOIN
                         dbo.ka7_tab ON dbo.k99_tab.idnka7_k99 = dbo.ka7_tab.idnka7_ka7
WHERE        (dbo.inventory_part_1_view.isttbl_k93 = 'k99')









