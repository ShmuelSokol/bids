-- dbo.supplier_part_1_view



/* view supplier_part_1_view: add view */


/* view supplier_part_1_view: add view */


/* view supplier_part_1_view: add view */

/* view supplier_part_1_view: add view */
CREATE VIEW dbo.supplier_part_1_view
AS
SELECT        K40_tab.spnnum_k40, K40_tab.spncge_k40, K40_tab.enauto_k40, K39_tab.s_code_k39, K12_tab.e_name_k12, K40_tab.rfqpok_k40, K39_tab.s_attn_k39, K39_tab.s_phon_k39, K39_tab.s_faxn_k39, K39_tab.s_emal_k39, 
                         K39_tab.rfqsok_k39, K39_tab.idnk12_k39, K40_tab.idnk08_k40, K39_tab.idnk39_k39, K40_tab.idnk40_k40
FROM            dbo.k40_tab AS K40_tab INNER JOIN
                         dbo.k39_tab AS K39_tab ON K40_tab.idnk39_k40 = K39_tab.idnk39_k39 INNER JOIN
                         dbo.k12_tab AS K12_tab ON K39_tab.idnk12_k39 = K12_tab.idnk12_k12




