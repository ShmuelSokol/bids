-- dbo.supplier_relationship_1_view



/* view supplier_relationship_1_view: add view */


/* view supplier_relationship_1_view: add view */


/* view supplier_relationship_1_view: add view */

/* view supplier_relationship_1_view: add view */
CREATE VIEW dbo.supplier_relationship_1_view
AS
SELECT        supplier_lft_view.s_code_k39 AS s_code_lft, supplier_lft_view.e_name_k12 AS e_name_lft, supplier_lft_view.idnk12_k12 AS idnk12_lft, supplier_lft_view.idnk39_k39 AS idnk39_lft, dbo.k59_tab.lrelte_k59, dbo.k59_tab.lftpri_k59, 
                         supplier_rht_view.s_code_k39 AS s_code_rht, supplier_rht_view.e_name_k12 AS e_name_rht, supplier_rht_view.idnk12_k12 AS idnk12_rht, supplier_rht_view.idnk39_k39 AS idnk39_rht, dbo.k59_tab.rrelte_k59, 
                         dbo.k59_tab.rhtpri_k59
FROM            dbo.k59_tab INNER JOIN
                         dbo.supplier_1_view AS supplier_lft_view ON dbo.k59_tab.lftk12_k59 = supplier_lft_view.idnk12_k12 INNER JOIN
                         dbo.supplier_1_view AS supplier_rht_view ON dbo.k59_tab.rhtk12_k59 = supplier_rht_view.idnk12_k12




